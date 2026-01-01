/**
 * FileManager
 * Handles file I/O operations for binary storage.
 * Provides a clean abstraction over Node.js fs operations.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface FileManagerConfig {
  baseDir: string;
}

export interface FileStats {
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  exists: boolean;
}

export class FileManager {
  private readonly baseDir: string;

  constructor(config: FileManagerConfig) {
    this.baseDir = config.baseDir;
  }

  /**
   * Read a file as a Buffer
   */
  readFile(filePath: string): Buffer {
    const fullPath = this.resolvePath(filePath);
    return fs.readFileSync(fullPath);
  }

  /**
   * Read a file as a Buffer, returning null if file doesn't exist
   */
  readFileOrNull(filePath: string): Buffer | null {
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.readFileSync(fullPath);
  }

  /**
   * Write a Buffer to a file, creating directories as needed
   */
  writeFile(filePath: string, data: Buffer): void {
    const fullPath = this.resolvePath(filePath);
    this.ensureDirectoryExists(fullPath);
    fs.writeFileSync(fullPath, data);
  }

  /**
   * Check if a file exists
   */
  exists(filePath: string): boolean {
    const fullPath = this.resolvePath(filePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Delete a file if it exists
   */
  delete(filePath: string): boolean {
    const fullPath = this.resolvePath(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  }

  /**
   * Get file statistics
   */
  getStats(filePath: string): FileStats {
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return {
        size: 0,
        createdAt: new Date(0),
        modifiedAt: new Date(0),
        exists: false,
      };
    }

    const stats = fs.statSync(fullPath);
    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      exists: true,
    };
  }

  /**
   * List files in a directory matching a pattern
   */
  listFiles(directory: string, extension?: string): string[] {
    const fullPath = this.resolvePath(directory);
    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const files = fs.readdirSync(fullPath);
    if (extension) {
      return files.filter((f) => f.endsWith(extension));
    }
    return files;
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  ensureDirectory(directory: string): void {
    const fullPath = this.resolvePath(directory);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  /**
   * Get the base directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Resolve a relative path to an absolute path
   */
  private resolvePath(relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }
    return path.join(this.baseDir, relativePath);
  }

  /**
   * Ensure the directory for a file path exists
   */
  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
