/**
 * Filesystem Errors
 *
 * Custom error classes for filesystem operations.
 */

/**
 * Base class for all filesystem errors.
 */
export class FsError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly code: string
  ) {
    super(`${message}: ${path}`);
    this.name = "FsError";
  }
}

/**
 * Thrown when a file or directory is not found.
 */
export class NotFoundError extends FsError {
  constructor(path: string) {
    super("Path not found", path, "ENOENT");
    this.name = "NotFoundError";
  }
}

/**
 * Thrown when a file or directory already exists.
 */
export class ExistsError extends FsError {
  constructor(path: string) {
    super("Path already exists", path, "EEXIST");
    this.name = "ExistsError";
  }
}

/**
 * Thrown when trying to perform a file operation on a directory or vice versa.
 */
export class TypeMismatchError extends FsError {
  constructor(path: string, expected: "file" | "directory") {
    super(`Expected ${expected}`, path, expected === "file" ? "EISDIR" : "ENOTDIR");
    this.name = "TypeMismatchError";
  }
}

/**
 * Thrown when trying to delete a non-empty directory without recursive flag.
 */
export class DirectoryNotEmptyError extends FsError {
  constructor(path: string) {
    super("Directory not empty", path, "ENOTEMPTY");
    this.name = "DirectoryNotEmptyError";
  }
}

/**
 * Thrown when the parent directory doesn't exist.
 */
export class ParentNotFoundError extends FsError {
  constructor(path: string) {
    super("Parent directory not found", path, "ENOENT");
    this.name = "ParentNotFoundError";
  }
}

/**
 * Thrown when a path is invalid (e.g., contains invalid characters, escapes root).
 */
export class InvalidPathError extends FsError {
  constructor(path: string, reason?: string) {
    super(reason || "Invalid path", path, "EINVAL");
    this.name = "InvalidPathError";
  }
}

/**
 * Thrown when storage quota is exceeded.
 */
export class QuotaExceededError extends FsError {
  constructor(path: string) {
    super("Storage quota exceeded", path, "ENOSPC");
    this.name = "QuotaExceededError";
  }
}

/**
 * Thrown when an operation is not supported by the implementation.
 */
export class NotSupportedError extends FsError {
  constructor(path: string, operation: string) {
    super(`Operation not supported: ${operation}`, path, "ENOTSUP");
    this.name = "NotSupportedError";
  }
}

/**
 * Check if an error is a specific filesystem error type.
 */
export function isFsError(error: unknown): error is FsError {
  return error instanceof FsError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isExistsError(error: unknown): error is ExistsError {
  return error instanceof ExistsError;
}
