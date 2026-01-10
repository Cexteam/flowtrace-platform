/**
 * LocalFileStorageAdapter
 * Implements FileStoragePort interface using Node.js fs module.
 * Provides local filesystem storage for hierarchical candle data.
 *
 * Key features:
 * - Atomic writes using temp file + rename pattern
 * - O(1) append operations using fs.appendFile
 * - Partial file reads/writes for header updates
 * - Returns null for non-existent files (no throwing)
 */

import { injectable, inject } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import type {
  FileStoragePort,
  FileInfo,
} from '../../../application/ports/out/FileStoragePort.js';
import { CANDLE_PERSISTENCE_TYPES } from '../../../di/types.js';

export interface LocalStorageConfig {
  /** Base directory for all file storage */
  baseDir: string;
}

@injectable()
export class LocalFileStorageAdapter implements FileStoragePort {
  constructor(
    @inject(CANDLE_PERSISTENCE_TYPES.LocalStorageConfig)
    private readonly config: LocalStorageConfig
  ) {}

  /**
   * Resolve relative path to absolute path
   */
  private resolvePath(relativePath: string): string {
    return path.join(this.config.baseDir, relativePath);
  }

  /**
   * Read a file as Buffer
   * @returns Buffer or null if file doesn't exist
   */
  async readFile(filePath: string): Promise<Buffer | null> {
    const fullPath = this.resolvePath(filePath);

    try {
      if (!fs.existsSync(fullPath)) {
        return null;
      }
      return await fs.promises.readFile(fullPath);
    } catch (error: unknown) {
      // Handle ENOENT gracefully
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a Buffer to a file using atomic write pattern.
   * Creates directories as needed.
   */
  async writeFile(filePath: string, data: Buffer): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.promises.mkdir(dir, { recursive: true });

    // Atomic write: write to temp file then rename
    const tempPath = `${fullPath}.tmp.${Date.now()}`;

    try {
      await fs.promises.writeFile(tempPath, data);
      await fs.promises.rename(tempPath, fullPath);
    } catch (error) {
      // Clean up temp file if rename failed
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Append data to end of existing file.
   * Creates file with directories if it doesn't exist.
   * O(1) operation - doesn't read existing content.
   */
  async appendFile(filePath: string, data: Buffer): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.promises.mkdir(dir, { recursive: true });

    // Use 'a' flag for append mode - O(1) operation
    await fs.promises.appendFile(fullPath, data);
  }

  /**
   * Read a specific byte range from a file.
   * Used for reading file headers without loading entire file.
   */
  async readFileRange(
    filePath: string,
    start: number,
    end: number
  ): Promise<Buffer | null> {
    const fullPath = this.resolvePath(filePath);

    try {
      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const fd = await fs.promises.open(fullPath, 'r');
      try {
        const length = end - start;
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await fd.read(buffer, 0, length, start);

        // Return only the bytes that were actually read
        if (bytesRead < length) {
          return buffer.subarray(0, bytesRead);
        }
        return buffer;
      } finally {
        await fd.close();
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write data to a specific byte range in a file.
   * Used for updating file headers without rewriting entire file.
   */
  async writeFileRange(
    filePath: string,
    start: number,
    data: Buffer
  ): Promise<void> {
    const fullPath = this.resolvePath(filePath);

    // File must exist for range write
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const fd = await fs.promises.open(fullPath, 'r+');
    try {
      await fd.write(data, 0, data.length, start);
    } finally {
      await fd.close();
    }
  }

  /**
   * Check if a file exists
   */
  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Delete a file
   * @returns true if deleted, false if didn't exist
   */
  async delete(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath);

    try {
      if (!fs.existsSync(fullPath)) {
        return false;
      }
      await fs.promises.unlink(fullPath);
      return true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List files in a directory
   * @returns Array of file names (not full paths)
   */
  async listFiles(directory: string, extension?: string): Promise<string[]> {
    const fullPath = this.resolvePath(directory);

    try {
      if (!fs.existsSync(fullPath)) {
        return [];
      }

      const entries = await fs.promises.readdir(fullPath, {
        withFileTypes: true,
      });

      let files = entries.filter((e) => e.isFile()).map((e) => e.name);

      if (extension) {
        files = files.filter((f) => f.endsWith(extension));
      }

      return files;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Ensure a directory exists, creating it recursively if needed
   */
  async ensureDirectory(directory: string): Promise<void> {
    const fullPath = this.resolvePath(directory);
    await fs.promises.mkdir(fullPath, { recursive: true });
  }

  /**
   * Get file metadata (size, modified time)
   */
  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    const fullPath = this.resolvePath(filePath);

    try {
      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const stats = await fs.promises.stat(fullPath);
      return {
        size: stats.size,
        modifiedAt: stats.mtime,
        exists: true,
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
