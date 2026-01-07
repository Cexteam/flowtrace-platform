/**
 * CloudFileStorageAdapter
 *
 * Cloud storage adapter implementing FileStoragePort.
 * Supports Google Cloud Storage (GCS) only.
 *
 * Features:
 * - GCS bucket operations
 * - Append using compose operations
 * - Range reads using Range header
 * - Retry logic with exponential backoff
 *
 * Note: Requires @google-cloud/storage to be installed separately.
 * This adapter uses dynamic import to avoid build errors when the package is not installed.
 */

import { injectable, inject } from 'inversify';
import type {
  FileStoragePort,
  FileInfo,
} from '../../application/ports/out/FileStoragePort.js';
import type { CloudStorageConfig } from '../../../../infrastructure/storage/hierarchical/types.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../di/types.js';

/** Default retry options */
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  retryDelayMs: 1000,
};

/**
 * GCS client interface (minimal typing for dynamic import)
 */
interface GCSClient {
  bucket(name: string): GCSBucket;
}

interface GCSBucket {
  file(name: string): GCSFile;
  getFiles(options: {
    prefix: string;
    delimiter: string;
  }): Promise<[GCSFile[]]>;
}

interface GCSFile {
  name: string;
  exists(): Promise<[boolean]>;
  download(options?: { start?: number; end?: number }): Promise<[Buffer]>;
  save(
    data: Buffer,
    options?: { resumable?: boolean; validation?: string }
  ): Promise<void>;
  delete(): Promise<void>;
  getMetadata(): Promise<[{ size: string; updated: string }]>;
}

/**
 * CloudFileStorageAdapter
 * Implements FileStoragePort for Google Cloud Storage
 */
@injectable()
export class CloudFileStorageAdapter implements FileStoragePort {
  private storage: GCSClient | null = null;
  private bucket: GCSBucket | null = null;
  private readonly prefix: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly config: CloudStorageConfig;
  private initialized = false;

  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.CloudStorageConfig)
    config: CloudStorageConfig
  ) {
    this.config = config;
    this.prefix = config.prefix ?? '';
    this.maxRetries =
      config.retryOptions?.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
    this.retryDelayMs =
      config.retryOptions?.retryDelayMs ?? DEFAULT_RETRY_OPTIONS.retryDelayMs;
  }

  /**
   * Initialize GCS client lazily
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import to avoid build errors when @google-cloud/storage is not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const gcs = await (Function(
        'return import("@google-cloud/storage")'
      )() as Promise<{
        Storage: new (options: {
          projectId?: string;
          keyFilename?: string;
        }) => GCSClient;
      }>);
      const StorageClass = gcs.Storage;

      this.storage = new StorageClass({
        projectId: this.config.projectId,
        keyFilename: this.config.keyFilePath,
      });

      this.bucket = this.storage.bucket(this.config.bucketName);
      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize GCS client. Make sure @google-cloud/storage is installed: ${error}`
      );
    }
  }

  /**
   * Read a file as Buffer
   */
  async readFile(path: string): Promise<Buffer | null> {
    await this.ensureInitialized();
    const file = this.getFile(path);

    try {
      const existsResult = await file.exists();
      if (!existsResult[0]) {
        return null;
      }

      const downloadResult = await this.withRetry(() => file.download());
      return downloadResult[0];
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a Buffer to a file
   */
  async writeFile(path: string, data: Buffer): Promise<void> {
    await this.ensureInitialized();
    const file = this.getFile(path);

    await this.withRetry(() =>
      file.save(data, {
        resumable: false,
        validation: 'crc32c',
      })
    );
  }

  /**
   * Append data to end of existing file
   * Uses GCS compose operation: download + append + upload
   * Note: GCS doesn't support true append, so we compose
   */
  async appendFile(path: string, data: Buffer): Promise<void> {
    await this.ensureInitialized();
    const file = this.getFile(path);

    try {
      const existsResult = await file.exists();

      if (!existsResult[0]) {
        // File doesn't exist, just write
        await this.writeFile(path, data);
        return;
      }

      // Download existing content
      const downloadResult = await this.withRetry(() => file.download());

      // Combine and upload
      const combined = Buffer.concat([downloadResult[0], data]);
      await this.writeFile(path, combined);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        // File doesn't exist, just write
        await this.writeFile(path, data);
        return;
      }
      throw error;
    }
  }

  /**
   * Read a specific byte range from a file
   * Uses Range header for efficient partial reads
   */
  async readFileRange(
    path: string,
    start: number,
    end: number
  ): Promise<Buffer | null> {
    await this.ensureInitialized();
    const file = this.getFile(path);

    try {
      const existsResult = await file.exists();
      if (!existsResult[0]) {
        return null;
      }

      const downloadResult = await this.withRetry(() =>
        file.download({
          start,
          end: end - 1, // GCS end is inclusive
        })
      );

      return downloadResult[0];
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write data to a specific byte range in a file
   * Downloads file, modifies range, uploads back
   */
  async writeFileRange(
    path: string,
    start: number,
    data: Buffer
  ): Promise<void> {
    await this.ensureInitialized();
    const file = this.getFile(path);

    // Download existing content
    const downloadResult = await this.withRetry(() => file.download());

    // Create new buffer with modified range
    const existing = downloadResult[0];
    const result = Buffer.alloc(Math.max(existing.length, start + data.length));
    existing.copy(result);
    data.copy(result, start);

    // Upload modified content
    await this.writeFile(path, result);
  }

  /**
   * Check if a file exists
   */
  async exists(path: string): Promise<boolean> {
    await this.ensureInitialized();
    const file = this.getFile(path);

    try {
      const existsResult = await file.exists();
      return existsResult[0];
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   */
  async delete(path: string): Promise<boolean> {
    await this.ensureInitialized();
    const file = this.getFile(path);

    try {
      const existsResult = await file.exists();
      if (!existsResult[0]) {
        return false;
      }

      await this.withRetry(() => file.delete());
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(directory: string, extension?: string): Promise<string[]> {
    await this.ensureInitialized();
    const prefix = this.resolvePath(directory);
    const prefixWithSlash = prefix.endsWith('/') ? prefix : `${prefix}/`;

    try {
      const filesResult = await this.bucket!.getFiles({
        prefix: prefixWithSlash,
        delimiter: '/',
      });

      let fileNames = filesResult[0].map((file: GCSFile) => {
        // Remove prefix to get just the filename
        const name = file.name.replace(prefixWithSlash, '');
        return name;
      });

      // Filter by extension if provided
      if (extension) {
        fileNames = fileNames.filter((name: string) =>
          name.endsWith(extension)
        );
      }

      // Filter out empty names and directories
      return fileNames.filter((name: string) => name && !name.endsWith('/'));
    } catch {
      return [];
    }
  }

  /**
   * Ensure a directory exists
   * In GCS, directories are virtual - just need to ensure prefix is valid
   */
  async ensureDirectory(_directory: string): Promise<void> {
    // GCS doesn't have real directories
    // Files are created with full path, directories are virtual
    // No action needed
  }

  /**
   * Get file metadata
   */
  async getFileInfo(path: string): Promise<FileInfo | null> {
    await this.ensureInitialized();
    const file = this.getFile(path);

    try {
      const existsResult = await file.exists();
      if (!existsResult[0]) {
        return null;
      }

      const metadataResult = await file.getMetadata();

      return {
        size: parseInt(metadataResult[0].size, 10) || 0,
        modifiedAt: new Date(metadataResult[0].updated),
        exists: true,
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get GCS File object for a path
   */
  private getFile(path: string): GCSFile {
    return this.bucket!.file(this.resolvePath(path));
  }

  /**
   * Resolve path with prefix
   */
  private resolvePath(path: string): string {
    if (this.prefix) {
      return `${this.prefix}/${path}`.replace(/\/+/g, '/');
    }
    return path;
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      return (error as { code: number }).code === 404;
    }
    return false;
  }

  /**
   * Execute operation with retry logic
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on not found errors
        if (this.isNotFoundError(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = this.retryDelayMs * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
