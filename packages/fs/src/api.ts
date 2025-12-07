/**
 * Filesystem API
 *
 * Abstract base class defining the filesystem interface.
 * Implementations provide concrete storage backends.
 */

import type {
  FileMetadata,
  ListOptions,
  WriteOptions,
  MkdirOptions,
  RemoveOptions,
  FsWatchCallback,
} from "./types";
import * as path from "./path";

/**
 * Abstract filesystem interface.
 *
 * All paths are absolute and use forward slashes.
 * The root directory "/" always exists.
 *
 * Error handling:
 * - stat/read operations return null if path not found
 * - write/delete operations throw if preconditions not met
 */
export abstract class Filesystem {
  /**
   * Implementation identifier (e.g., "localStorage", "local", "gcs")
   */
  abstract readonly type: string;

  // ===========================================================================
  // Path Utilities (delegated to path module)
  // ===========================================================================

  /**
   * Normalize a path.
   */
  normalize(p: string): string {
    return path.normalize(p);
  }

  /**
   * Join path segments.
   */
  join(...parts: string[]): string {
    return path.join(...parts);
  }

  /**
   * Resolve a relative path against a base.
   */
  resolve(base: string, relative: string): string {
    return path.resolve(base, relative);
  }

  /**
   * Get the directory part of a path.
   */
  dirname(p: string): string {
    return path.dirname(p);
  }

  /**
   * Get the file/directory name from a path.
   */
  basename(p: string, ext?: string): string {
    return path.basename(p, ext);
  }

  /**
   * Get the extension of a path.
   */
  extname(p: string): string {
    return path.extname(p);
  }

  /**
   * Get the relative path from one path to another.
   */
  relative(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Check if a path is inside another.
   */
  isInside(parent: string, child: string): boolean {
    return path.isInside(parent, child);
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Get metadata for a file or directory.
   * Returns null if the path doesn't exist.
   */
  abstract stat(path: string): Promise<FileMetadata | null>;

  /**
   * Check if a path exists.
   */
  async exists(path: string): Promise<boolean> {
    const meta = await this.stat(path);
    return meta !== null;
  }

  /**
   * Check if a path is a directory.
   */
  async isDirectory(path: string): Promise<boolean> {
    const meta = await this.stat(path);
    return meta?.isDirectory ?? false;
  }

  /**
   * Check if a path is a file.
   */
  async isFile(path: string): Promise<boolean> {
    const meta = await this.stat(path);
    return meta !== null && !meta.isDirectory;
  }

  /**
   * Read a file as text.
   * Returns null if the file doesn't exist.
   * Throws TypeMismatchError if path is a directory.
   */
  abstract readText(path: string): Promise<string | null>;

  /**
   * Read a file as binary data.
   * Returns null if the file doesn't exist.
   * Throws TypeMismatchError if path is a directory.
   */
  abstract readBinary(path: string): Promise<ArrayBuffer | null>;

  /**
   * List contents of a directory.
   * Returns empty array if directory doesn't exist.
   * Throws TypeMismatchError if path is a file.
   */
  abstract list(path: string, options?: ListOptions): Promise<FileMetadata[]>;

  // ===========================================================================
  // Write Operations
  // ===========================================================================

  /**
   * Write text content to a file.
   * Creates the file if it doesn't exist.
   * Throws ParentNotFoundError if parent directory doesn't exist
   * (unless createParents is true).
   * Throws ExistsError if file exists and overwrite is false.
   * Throws TypeMismatchError if path is a directory.
   */
  abstract writeText(
    path: string,
    content: string,
    options?: WriteOptions
  ): Promise<void>;

  /**
   * Write binary content to a file.
   * Same behavior as writeText.
   */
  abstract writeBinary(
    path: string,
    content: ArrayBuffer,
    options?: WriteOptions
  ): Promise<void>;

  /**
   * Create a directory.
   * Throws ParentNotFoundError if parent doesn't exist (unless recursive).
   * Does nothing if directory already exists.
   * Throws TypeMismatchError if path exists as a file.
   */
  abstract mkdir(path: string, options?: MkdirOptions): Promise<void>;

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  /**
   * Remove a file.
   * Does nothing if file doesn't exist.
   * Throws TypeMismatchError if path is a directory.
   */
  abstract remove(path: string): Promise<void>;

  /**
   * Remove a directory.
   * Does nothing if directory doesn't exist.
   * Throws DirectoryNotEmptyError if not empty (unless recursive).
   * Throws TypeMismatchError if path is a file.
   */
  abstract rmdir(path: string, options?: RemoveOptions): Promise<void>;

  // ===========================================================================
  // Move/Copy Operations
  // ===========================================================================

  /**
   * Move/rename a file or directory.
   * Throws NotFoundError if source doesn't exist.
   * Throws ExistsError if destination exists.
   * Throws ParentNotFoundError if destination parent doesn't exist.
   */
  abstract move(from: string, to: string): Promise<void>;

  /**
   * Copy a file or directory.
   * Throws NotFoundError if source doesn't exist.
   * Throws ExistsError if destination exists.
   * Throws ParentNotFoundError if destination parent doesn't exist.
   */
  abstract copy(from: string, to: string): Promise<void>;

  // ===========================================================================
  // Watch (Optional)
  // ===========================================================================

  /**
   * Watch a path for changes.
   * Returns an unsubscribe function.
   * Not all implementations support this.
   */
  watch?(path: string, callback: FsWatchCallback): () => void;

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Read a JSON file and parse it.
   * Returns null if file doesn't exist.
   */
  async readJSON<T = unknown>(path: string): Promise<T | null> {
    const text = await this.readText(path);
    if (text === null) return null;
    return JSON.parse(text) as T;
  }

  /**
   * Write an object as JSON to a file.
   */
  async writeJSON(
    path: string,
    data: unknown,
    options?: WriteOptions
  ): Promise<void> {
    const text = JSON.stringify(data, null, 2);
    await this.writeText(path, text, {
      ...options,
      mimeType: options?.mimeType ?? "application/json",
    });
  }

  /**
   * Ensure a directory exists (create if needed).
   */
  async ensureDir(path: string): Promise<void> {
    await this.mkdir(path, { recursive: true });
  }

  /**
   * Remove a file or directory (recursive for directories).
   */
  async rm(path: string): Promise<void> {
    const meta = await this.stat(path);
    if (!meta) return;

    if (meta.isDirectory) {
      await this.rmdir(path, { recursive: true });
    } else {
      await this.remove(path);
    }
  }

  /**
   * Get all files matching a pattern (simple glob).
   * Currently supports:
   * - Exact paths
   * - Extension filter (e.g., "*.vibecad")
   */
  async glob(
    pattern: string,
    basePath: string = "/"
  ): Promise<FileMetadata[]> {
    const results: FileMetadata[] = [];

    // Simple extension matching
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1); // e.g., ".vibecad"
      const files = await this.list(basePath, { recursive: true, filesOnly: true });
      for (const file of files) {
        if (file.name.endsWith(ext)) {
          results.push(file);
        }
      }
      return results;
    }

    // Exact path
    const meta = await this.stat(this.join(basePath, pattern));
    if (meta && !meta.isDirectory) {
      results.push(meta);
    }

    return results;
  }
}
