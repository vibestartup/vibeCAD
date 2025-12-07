/**
 * Filesystem Types
 *
 * Core type definitions for the virtual filesystem abstraction.
 */

/**
 * Metadata for a file or directory entry.
 */
export interface FileMetadata {
  /** Absolute path within the filesystem */
  path: string;
  /** Name of the file/directory (basename) */
  name: string;
  /** True if this is a directory */
  isDirectory: boolean;
  /** Size in bytes (0 for directories) */
  size: number;
  /** MIME type (e.g., "application/json", "image/png") */
  mimeType: string;
  /** Creation timestamp (ms since epoch) */
  createdAt: number;
  /** Last modification timestamp (ms since epoch) */
  modifiedAt: number;
}

/**
 * Extended metadata stored by implementations (not part of core FS API).
 * Used for implementation-specific data like thumbnails.
 */
export interface ExtendedMetadata extends FileMetadata {
  /** Base64 thumbnail for preview (implementation-specific) */
  thumbnail?: string;
  /** Custom metadata key-value pairs */
  custom?: Record<string, unknown>;
}

/**
 * Options for listing directory contents.
 */
export interface ListOptions {
  /** If true, recursively list all descendants */
  recursive?: boolean;
  /** Filter by file extension (e.g., ".vibecad") */
  extension?: string;
  /** Filter by MIME type */
  mimeType?: string;
  /** Include only files (exclude directories) */
  filesOnly?: boolean;
  /** Include only directories (exclude files) */
  directoriesOnly?: boolean;
}

/**
 * Options for write operations.
 */
export interface WriteOptions {
  /** MIME type for the content */
  mimeType?: string;
  /** If false, throw if file already exists (default: true) */
  overwrite?: boolean;
  /** Create parent directories if they don't exist (default: false) */
  createParents?: boolean;
}

/**
 * Options for directory creation.
 */
export interface MkdirOptions {
  /** Create parent directories if they don't exist */
  recursive?: boolean;
}

/**
 * Options for remove operations.
 */
export interface RemoveOptions {
  /** For directories: remove contents recursively */
  recursive?: boolean;
}

/**
 * Filesystem event types for watch functionality.
 */
export type FsEventType = "create" | "modify" | "delete" | "rename";

/**
 * Filesystem change event.
 */
export interface FsEvent {
  type: FsEventType;
  path: string;
  /** For rename events, the previous path */
  oldPath?: string;
}

/**
 * Callback for filesystem watch events.
 */
export type FsWatchCallback = (event: FsEvent) => void;

/**
 * Common MIME types for CAD files.
 */
export const MIME_TYPES = {
  VIBECAD: "application/x-vibecad+json",
  STEP: "application/step",
  STL: "model/stl",
  OBJ: "model/obj",
  GLTF: "model/gltf+json",
  JSON: "application/json",
  PNG: "image/png",
  JPEG: "image/jpeg",
  SVG: "image/svg+xml",
  TEXT: "text/plain",
  BINARY: "application/octet-stream",
} as const;

/**
 * Get MIME type from file extension.
 */
export function getMimeType(path: string): string {
  const ext = path.toLowerCase().split(".").pop() || "";
  const mimeMap: Record<string, string> = {
    vibecad: MIME_TYPES.VIBECAD,
    json: MIME_TYPES.JSON,
    step: MIME_TYPES.STEP,
    stp: MIME_TYPES.STEP,
    stl: MIME_TYPES.STL,
    obj: MIME_TYPES.OBJ,
    gltf: MIME_TYPES.GLTF,
    glb: MIME_TYPES.GLTF,
    png: MIME_TYPES.PNG,
    jpg: MIME_TYPES.JPEG,
    jpeg: MIME_TYPES.JPEG,
    svg: MIME_TYPES.SVG,
    txt: MIME_TYPES.TEXT,
  };
  return mimeMap[ext] || MIME_TYPES.BINARY;
}
