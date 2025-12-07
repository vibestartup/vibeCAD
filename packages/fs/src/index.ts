/**
 * @vibecad/fs - Filesystem abstraction for vibeCAD
 *
 * Provides a virtual filesystem API with pluggable storage backends.
 *
 * @example
 * ```ts
 * import { LocalStorageFilesystem } from "@vibecad/fs";
 *
 * const fs = new LocalStorageFilesystem();
 *
 * // Create a directory
 * await fs.mkdir("/My Parts", { recursive: true });
 *
 * // Write a file
 * await fs.writeText("/My Parts/bracket.vibecad", JSON.stringify(data));
 *
 * // Read it back
 * const content = await fs.readText("/My Parts/bracket.vibecad");
 *
 * // List directory contents
 * const files = await fs.list("/My Parts");
 * ```
 */

// Core API
export { Filesystem } from "./api";

// Types
export type {
  FileMetadata,
  ExtendedMetadata,
  ListOptions,
  WriteOptions,
  MkdirOptions,
  RemoveOptions,
  FsEventType,
  FsEvent,
  FsWatchCallback,
} from "./types";
export { MIME_TYPES, getMimeType } from "./types";

// Errors
export {
  FsError,
  NotFoundError,
  ExistsError,
  TypeMismatchError,
  DirectoryNotEmptyError,
  ParentNotFoundError,
  InvalidPathError,
  QuotaExceededError,
  NotSupportedError,
  isFsError,
  isNotFoundError,
  isExistsError,
} from "./errors";

// Path utilities
export * as path from "./path";

// Implementations
export { LocalStorageFilesystem } from "./impl/local-storage";
