/**
 * LocalStorage Filesystem Implementation
 *
 * Implements the Filesystem API using browser localStorage.
 *
 * Storage schema:
 * - vibecad-fs:dir:{path}  -> DirectoryEntry JSON (for directories)
 * - vibecad-fs:meta:{path} -> FileEntry JSON (metadata for files)
 * - vibecad-fs:data:{path} -> string content (file data)
 *
 * The root directory "/" is auto-created on first access.
 */

import { Filesystem } from "../api";
import type {
  FileMetadata,
  ExtendedMetadata,
  ListOptions,
  WriteOptions,
  MkdirOptions,
  RemoveOptions,
  FsEvent,
  FsWatchCallback,
} from "../types";
import { getMimeType } from "../types";
import {
  NotFoundError,
  ExistsError,
  TypeMismatchError,
  DirectoryNotEmptyError,
  ParentNotFoundError,
  InvalidPathError,
} from "../errors";
import * as path from "../path";

// Storage key prefixes
const PREFIX = "vibecad-fs:";
const DIR_PREFIX = PREFIX + "dir:";
const META_PREFIX = PREFIX + "meta:";
const DATA_PREFIX = PREFIX + "data:";

/**
 * Internal directory entry stored in localStorage.
 */
interface DirectoryEntry {
  createdAt: number;
  modifiedAt: number;
}

/**
 * Internal file entry stored in localStorage.
 */
interface FileEntry {
  size: number;
  mimeType: string;
  createdAt: number;
  modifiedAt: number;
  thumbnail?: string;
  custom?: Record<string, unknown>;
}

/**
 * Filesystem implementation using browser localStorage.
 */
export class LocalStorageFilesystem extends Filesystem {
  readonly type = "localStorage";

  private storage: Storage;
  private watchers: Map<string, Set<FsWatchCallback>> = new Map();
  private initialized = false;

  constructor(storage: Storage = localStorage) {
    super();
    this.storage = storage;
  }

  /**
   * Ensure root directory exists.
   */
  private ensureInitialized(): void {
    if (this.initialized) return;

    const rootKey = DIR_PREFIX + "/";
    if (!this.storage.getItem(rootKey)) {
      const now = Date.now();
      const entry: DirectoryEntry = { createdAt: now, modifiedAt: now };
      this.storage.setItem(rootKey, JSON.stringify(entry));
    }
    this.initialized = true;
  }

  /**
   * Validate and normalize a path.
   */
  private normalizePath(p: string): string {
    const normalized = path.normalize(p);
    if (!path.isValidPath(normalized)) {
      throw new InvalidPathError(p);
    }
    return normalized;
  }

  /**
   * Emit a filesystem event to watchers.
   */
  private emit(event: FsEvent): void {
    // Notify watchers for the exact path
    const callbacks = this.watchers.get(event.path);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(event);
        } catch (e) {
          console.error("[LocalStorageFS] Watch callback error:", e);
        }
      }
    }

    // Notify parent directory watchers
    const parentPath = path.dirname(event.path);
    if (parentPath !== event.path) {
      const parentCallbacks = this.watchers.get(parentPath);
      if (parentCallbacks) {
        for (const cb of parentCallbacks) {
          try {
            cb(event);
          } catch (e) {
            console.error("[LocalStorageFS] Watch callback error:", e);
          }
        }
      }
    }
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  async stat(p: string): Promise<FileMetadata | null> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    // Check if it's a directory
    const dirKey = DIR_PREFIX + normalized;
    const dirEntry = this.storage.getItem(dirKey);
    if (dirEntry) {
      const entry: DirectoryEntry = JSON.parse(dirEntry);
      return {
        path: normalized,
        name: path.basename(normalized) || "/",
        isDirectory: true,
        size: 0,
        mimeType: "inode/directory",
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
      };
    }

    // Check if it's a file
    const metaKey = META_PREFIX + normalized;
    const metaEntry = this.storage.getItem(metaKey);
    if (metaEntry) {
      const entry: FileEntry = JSON.parse(metaEntry);
      return {
        path: normalized,
        name: path.basename(normalized),
        isDirectory: false,
        size: entry.size,
        mimeType: entry.mimeType,
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
      };
    }

    return null;
  }

  /**
   * Get extended metadata (including thumbnail).
   */
  async statExtended(p: string): Promise<ExtendedMetadata | null> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    const metaKey = META_PREFIX + normalized;
    const metaEntry = this.storage.getItem(metaKey);
    if (metaEntry) {
      const entry: FileEntry = JSON.parse(metaEntry);
      return {
        path: normalized,
        name: path.basename(normalized),
        isDirectory: false,
        size: entry.size,
        mimeType: entry.mimeType,
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
        thumbnail: entry.thumbnail,
        custom: entry.custom,
      };
    }

    // Fall back to regular stat for directories
    return this.stat(p) as Promise<ExtendedMetadata | null>;
  }

  /**
   * Update extended metadata (e.g., thumbnail).
   */
  async updateMetadata(
    p: string,
    updates: { thumbnail?: string; custom?: Record<string, unknown> }
  ): Promise<void> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    const metaKey = META_PREFIX + normalized;
    const metaEntry = this.storage.getItem(metaKey);
    if (!metaEntry) {
      throw new NotFoundError(p);
    }

    const entry: FileEntry = JSON.parse(metaEntry);
    if (updates.thumbnail !== undefined) {
      entry.thumbnail = updates.thumbnail;
    }
    if (updates.custom !== undefined) {
      entry.custom = { ...entry.custom, ...updates.custom };
    }
    entry.modifiedAt = Date.now();

    this.storage.setItem(metaKey, JSON.stringify(entry));
    this.emit({ type: "modify", path: normalized });
  }

  async readText(p: string): Promise<string | null> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    // Check if it's a directory
    const dirKey = DIR_PREFIX + normalized;
    if (this.storage.getItem(dirKey)) {
      throw new TypeMismatchError(p, "file");
    }

    // Check if file exists
    const metaKey = META_PREFIX + normalized;
    if (!this.storage.getItem(metaKey)) {
      return null;
    }

    const dataKey = DATA_PREFIX + normalized;
    return this.storage.getItem(dataKey);
  }

  async readBinary(p: string): Promise<ArrayBuffer | null> {
    const text = await this.readText(p);
    if (text === null) return null;

    // Assume base64 encoding for binary data
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async list(p: string, options?: ListOptions): Promise<FileMetadata[]> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    // Verify path is a directory
    const dirKey = DIR_PREFIX + normalized;
    if (!this.storage.getItem(dirKey)) {
      // Check if it's a file
      const metaKey = META_PREFIX + normalized;
      if (this.storage.getItem(metaKey)) {
        throw new TypeMismatchError(p, "directory");
      }
      // Directory doesn't exist, return empty
      return [];
    }

    const results: FileMetadata[] = [];
    const prefix = normalized === "/" ? "/" : normalized + "/";

    // Scan all keys for children
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key) continue;

      let childPath: string | null = null;
      let isDir = false;

      if (key.startsWith(DIR_PREFIX)) {
        childPath = key.slice(DIR_PREFIX.length);
        isDir = true;
      } else if (key.startsWith(META_PREFIX)) {
        childPath = key.slice(META_PREFIX.length);
        isDir = false;
      }

      if (!childPath || childPath === "/") continue;

      // Check if this is a child of our directory
      if (!childPath.startsWith(prefix)) continue;

      // Get relative path from our directory
      const relativePath = childPath.slice(prefix.length);

      // If not recursive, only include direct children
      if (!options?.recursive && relativePath.includes("/")) {
        continue;
      }

      // Apply filters
      if (options?.filesOnly && isDir) continue;
      if (options?.directoriesOnly && !isDir) continue;
      if (options?.extension && !childPath.endsWith(options.extension)) continue;

      // Get full metadata
      const meta = await this.stat(childPath);
      if (meta) {
        if (options?.mimeType && meta.mimeType !== options.mimeType) continue;
        results.push(meta);
      }
    }

    // Sort by name
    results.sort((a, b) => {
      // Directories first
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return results;
  }

  // ===========================================================================
  // Write Operations
  // ===========================================================================

  async writeText(
    p: string,
    content: string,
    options?: WriteOptions
  ): Promise<void> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    if (normalized === "/") {
      throw new InvalidPathError(p, "Cannot write to root");
    }

    // Check if it's a directory
    const dirKey = DIR_PREFIX + normalized;
    if (this.storage.getItem(dirKey)) {
      throw new TypeMismatchError(p, "file");
    }

    // Check parent directory
    const parentPath = path.dirname(normalized);
    const parentDirKey = DIR_PREFIX + parentPath;
    if (!this.storage.getItem(parentDirKey)) {
      if (options?.createParents) {
        await this.mkdir(parentPath, { recursive: true });
      } else {
        throw new ParentNotFoundError(p);
      }
    }

    // Check if file exists
    const metaKey = META_PREFIX + normalized;
    const existingMeta = this.storage.getItem(metaKey);
    if (existingMeta && options?.overwrite === false) {
      throw new ExistsError(p);
    }

    const now = Date.now();
    const mimeType = options?.mimeType || getMimeType(normalized);

    // Preserve existing metadata if updating
    let entry: FileEntry;
    if (existingMeta) {
      const existing: FileEntry = JSON.parse(existingMeta);
      entry = {
        ...existing,
        size: content.length,
        mimeType,
        modifiedAt: now,
      };
    } else {
      entry = {
        size: content.length,
        mimeType,
        createdAt: now,
        modifiedAt: now,
      };
    }

    // Write metadata and content
    this.storage.setItem(metaKey, JSON.stringify(entry));
    this.storage.setItem(DATA_PREFIX + normalized, content);

    // Update parent directory modifiedAt
    this.touchDirectory(parentPath);

    this.emit({ type: existingMeta ? "modify" : "create", path: normalized });
  }

  async writeBinary(
    p: string,
    content: ArrayBuffer,
    options?: WriteOptions
  ): Promise<void> {
    // Encode as base64
    const bytes = new Uint8Array(content);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    await this.writeText(p, base64, options);
  }

  async mkdir(p: string, options?: MkdirOptions): Promise<void> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    if (normalized === "/") {
      // Root always exists
      return;
    }

    // Check if already exists as directory
    const dirKey = DIR_PREFIX + normalized;
    if (this.storage.getItem(dirKey)) {
      return;
    }

    // Check if exists as file
    const metaKey = META_PREFIX + normalized;
    if (this.storage.getItem(metaKey)) {
      throw new TypeMismatchError(p, "directory");
    }

    // Check parent
    const parentPath = path.dirname(normalized);
    const parentDirKey = DIR_PREFIX + parentPath;
    if (!this.storage.getItem(parentDirKey)) {
      if (options?.recursive) {
        await this.mkdir(parentPath, { recursive: true });
      } else {
        throw new ParentNotFoundError(p);
      }
    }

    // Create directory
    const now = Date.now();
    const entry: DirectoryEntry = { createdAt: now, modifiedAt: now };
    this.storage.setItem(dirKey, JSON.stringify(entry));

    // Update parent
    this.touchDirectory(parentPath);

    this.emit({ type: "create", path: normalized });
  }

  /**
   * Update a directory's modifiedAt timestamp.
   */
  private touchDirectory(p: string): void {
    const dirKey = DIR_PREFIX + p;
    const entry = this.storage.getItem(dirKey);
    if (entry) {
      const parsed: DirectoryEntry = JSON.parse(entry);
      parsed.modifiedAt = Date.now();
      this.storage.setItem(dirKey, JSON.stringify(parsed));
    }
  }

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  async remove(p: string): Promise<void> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    // Check if it's a directory
    const dirKey = DIR_PREFIX + normalized;
    if (this.storage.getItem(dirKey)) {
      throw new TypeMismatchError(p, "file");
    }

    // Check if file exists
    const metaKey = META_PREFIX + normalized;
    if (!this.storage.getItem(metaKey)) {
      return; // Already doesn't exist
    }

    // Remove metadata and content
    this.storage.removeItem(metaKey);
    this.storage.removeItem(DATA_PREFIX + normalized);

    // Update parent
    const parentPath = path.dirname(normalized);
    this.touchDirectory(parentPath);

    this.emit({ type: "delete", path: normalized });
  }

  async rmdir(p: string, options?: RemoveOptions): Promise<void> {
    this.ensureInitialized();
    const normalized = this.normalizePath(p);

    if (normalized === "/") {
      throw new InvalidPathError(p, "Cannot remove root directory");
    }

    // Check if it's a file
    const metaKey = META_PREFIX + normalized;
    if (this.storage.getItem(metaKey)) {
      throw new TypeMismatchError(p, "directory");
    }

    // Check if directory exists
    const dirKey = DIR_PREFIX + normalized;
    if (!this.storage.getItem(dirKey)) {
      return; // Already doesn't exist
    }

    // Check if empty
    const contents = await this.list(normalized);
    if (contents.length > 0) {
      if (options?.recursive) {
        // Remove contents recursively
        for (const item of contents) {
          if (item.isDirectory) {
            await this.rmdir(item.path, { recursive: true });
          } else {
            await this.remove(item.path);
          }
        }
      } else {
        throw new DirectoryNotEmptyError(p);
      }
    }

    // Remove directory
    this.storage.removeItem(dirKey);

    // Update parent
    const parentPath = path.dirname(normalized);
    this.touchDirectory(parentPath);

    this.emit({ type: "delete", path: normalized });
  }

  // ===========================================================================
  // Move/Copy Operations
  // ===========================================================================

  async move(from: string, to: string): Promise<void> {
    this.ensureInitialized();
    const fromNorm = this.normalizePath(from);
    const toNorm = this.normalizePath(to);

    // Copy then delete
    await this.copy(fromNorm, toNorm);

    const meta = await this.stat(fromNorm);
    if (meta?.isDirectory) {
      await this.rmdir(fromNorm, { recursive: true });
    } else {
      await this.remove(fromNorm);
    }

    this.emit({ type: "rename", path: toNorm, oldPath: fromNorm });
  }

  async copy(from: string, to: string): Promise<void> {
    this.ensureInitialized();
    const fromNorm = this.normalizePath(from);
    const toNorm = this.normalizePath(to);

    // Check source exists
    const sourceMeta = await this.stat(fromNorm);
    if (!sourceMeta) {
      throw new NotFoundError(from);
    }

    // Check destination doesn't exist
    if (await this.exists(toNorm)) {
      throw new ExistsError(to);
    }

    // Check destination parent exists
    const toParent = path.dirname(toNorm);
    if (!(await this.isDirectory(toParent))) {
      throw new ParentNotFoundError(to);
    }

    if (sourceMeta.isDirectory) {
      // Copy directory recursively
      await this.mkdir(toNorm);
      const contents = await this.list(fromNorm);
      for (const item of contents) {
        const relativeName = path.basename(item.path);
        await this.copy(item.path, path.join(toNorm, relativeName));
      }
    } else {
      // Copy file
      const content = await this.readText(fromNorm);
      if (content !== null) {
        const extMeta = await this.statExtended(fromNorm);
        await this.writeText(toNorm, content, { mimeType: sourceMeta.mimeType });
        // Copy extended metadata
        if (extMeta?.thumbnail || extMeta?.custom) {
          await this.updateMetadata(toNorm, {
            thumbnail: extMeta.thumbnail,
            custom: extMeta.custom,
          });
        }
      }
    }
  }

  // ===========================================================================
  // Watch
  // ===========================================================================

  watch(p: string, callback: FsWatchCallback): () => void {
    const normalized = this.normalizePath(p);

    if (!this.watchers.has(normalized)) {
      this.watchers.set(normalized, new Set());
    }
    this.watchers.get(normalized)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.watchers.get(normalized);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.watchers.delete(normalized);
        }
      }
    };
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  /**
   * Clear all filesystem data from storage.
   * Use with caution!
   */
  async clear(): Promise<void> {
    const keysToRemove: string[] = [];

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(PREFIX)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.storage.removeItem(key);
    }

    this.initialized = false;
    this.ensureInitialized();
  }

  /**
   * Get approximate storage usage in bytes.
   */
  getStorageUsage(): { used: number; items: number } {
    let used = 0;
    let items = 0;

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(PREFIX)) {
        items++;
        const value = this.storage.getItem(key);
        if (value) {
          // Approximate: 2 bytes per character in UTF-16
          used += (key.length + value.length) * 2;
        }
      }
    }

    return { used, items };
  }
}
