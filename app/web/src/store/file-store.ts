/**
 * File Store - filesystem-based file management for vibeCAD
 *
 * Manages files and folders in a virtual filesystem using LocalStorageFilesystem.
 *
 * File Format:
 * - Each .vibecad file is a single PartStudio (not a Document with multiple studios)
 * - 1 file = 1 tab = 1 operation graph
 * - Assemblies are just PartStudios that use InsertPart/Mate operations
 */

import { create } from "zustand";
import {
  LocalStorageFilesystem,
  type FileMetadata,
  type ExtendedMetadata,
  path,
  MIME_TYPES,
} from "@vibecad/fs";
import type { PartStudio, PartStudioMeta, ParamEnv } from "@vibecad/core";

// ============================================================================
// Filesystem Singleton
// ============================================================================

let _fs: LocalStorageFilesystem | null = null;

export function getFs(): LocalStorageFilesystem {
  if (!_fs) {
    _fs = new LocalStorageFilesystem();
  }
  return _fs;
}

// ============================================================================
// Types
// ============================================================================

export interface FileEntry extends FileMetadata {
  thumbnail?: string;
}

export interface FolderContents {
  path: string;
  entries: FileEntry[];
}

interface FileStoreState {
  // Current directory being viewed
  currentPath: string;
  // Contents of current directory
  contents: FileEntry[];
  // Currently open file path (if any)
  openFilePath: string | null;
  // Loading state
  isLoading: boolean;
  // Error state
  error: string | null;

  // Actions
  navigateTo: (path: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  refresh: () => Promise<void>;
  createFolder: (name: string) => Promise<string>;
  saveFile: (
    name: string,
    content: string,
    options?: { thumbnail?: string; folder?: string }
  ) => Promise<string>;
  savePartStudio: (
    studio: PartStudio,
    options?: { thumbnail?: string; path?: string }
  ) => Promise<string>;
  loadPartStudio: (filePath: string) => Promise<PartStudio | null>;
  deleteEntry: (entryPath: string) => Promise<void>;
  renameEntry: (oldPath: string, newName: string) => Promise<void>;
  moveEntry: (fromPath: string, toPath: string) => Promise<void>;
  setOpenFilePath: (path: string | null) => void;
  getExtendedMetadata: (filePath: string) => Promise<ExtendedMetadata | null>;
  updateThumbnail: (filePath: string, thumbnail: string) => Promise<void>;
}

// ============================================================================
// Serialization - PartStudio (new format)
// ============================================================================

/** File format version for migration support */
const FILE_FORMAT_VERSION = 2;

interface SerializedPartStudioV2 {
  /** Format version - 2 = new PartStudio-only format */
  formatVersion: 2;
  id: string;
  name: string;
  planes: Array<[string, unknown]>;
  sketches: Array<[string, SerializedSketch]>;
  opGraph: Array<[string, unknown]>;
  opOrder: string[];
  params: {
    params: Array<[string, unknown]>;
    errors: Array<[string, string]>;
  };
  meta: PartStudioMeta;
}

interface SerializedSketch {
  id: string;
  name: string;
  planeId: string;
  primitives: Array<[string, unknown]>;
  constraints: Array<[string, unknown]>;
  solvedPositions?: Array<[string, unknown]>;
  solveStatus?: string;
  dof?: number;
}

// Legacy format for backwards compatibility
interface SerializedDocumentV1 {
  id: string;
  name: string;
  params: {
    params: Array<[string, unknown]>;
    errors: Array<[string, string]>;
  };
  partStudios: Array<[string, SerializedPartStudioLegacy]>;
  parts: Array<[string, unknown]>;
  assemblies: Array<[string, unknown]>;
  meta: {
    createdAt: number;
    modifiedAt: number;
    version: number;
  };
}

interface SerializedPartStudioLegacy {
  id: string;
  name: string;
  planes: Array<[string, unknown]>;
  sketches: Array<[string, SerializedSketch]>;
  opGraph: Array<[string, unknown]>;
  opOrder: string[];
  results?: Array<[string, unknown]>;
}

function serializeMap<K, V>(map: Map<K, V>): Array<[K, V]> {
  return Array.from(map.entries());
}

function deserializeMap<K, V>(entries: Array<[K, V]>): Map<K, V> {
  return new Map(entries);
}

function serializeSketch(sketch: any): SerializedSketch {
  return {
    id: sketch.id,
    name: sketch.name,
    planeId: sketch.planeId,
    primitives: serializeMap(sketch.primitives),
    constraints: serializeMap(sketch.constraints),
    solvedPositions: sketch.solvedPositions
      ? serializeMap(sketch.solvedPositions)
      : undefined,
    solveStatus: sketch.solveStatus,
    dof: sketch.dof,
  };
}

function deserializeSketch(data: SerializedSketch): any {
  return {
    id: data.id,
    name: data.name,
    planeId: data.planeId,
    primitives: deserializeMap(data.primitives),
    constraints: deserializeMap(data.constraints),
    solvedPositions: data.solvedPositions
      ? deserializeMap(data.solvedPositions)
      : undefined,
    solveStatus: data.solveStatus,
    dof: data.dof,
  };
}

/**
 * Serialize a PartStudio for saving to file.
 */
export function serializePartStudio(studio: PartStudio): SerializedPartStudioV2 {
  const serializedSketches = Array.from(
    studio.sketches.entries() as Iterable<[string, any]>
  ).map(
    ([id, sketch]) => [id, serializeSketch(sketch)] as [string, SerializedSketch]
  );

  return {
    formatVersion: FILE_FORMAT_VERSION,
    id: studio.id,
    name: studio.name,
    planes: serializeMap(studio.planes),
    sketches: serializedSketches,
    opGraph: serializeMap(studio.opGraph),
    opOrder: studio.opOrder,
    params: {
      params: serializeMap(studio.params.params),
      errors: serializeMap(studio.params.errors),
    },
    meta: studio.meta,
  };
}

/**
 * Deserialize a PartStudio from file data.
 * Supports both v2 (new) and v1 (legacy Document) formats.
 */
export function deserializePartStudio(data: unknown): PartStudio {
  // Check if it's the new format (has formatVersion: 2)
  if (isSerializedPartStudioV2(data)) {
    return deserializePartStudioV2(data);
  }

  // Check if it's the legacy Document format (has partStudios array)
  if (isSerializedDocumentV1(data)) {
    return deserializeFromLegacyDocument(data);
  }

  throw new Error("Unknown file format");
}

function isSerializedPartStudioV2(data: unknown): data is SerializedPartStudioV2 {
  return (
    typeof data === "object" &&
    data !== null &&
    "formatVersion" in data &&
    (data as any).formatVersion === 2
  );
}

function isSerializedDocumentV1(data: unknown): data is SerializedDocumentV1 {
  return (
    typeof data === "object" &&
    data !== null &&
    "partStudios" in data &&
    Array.isArray((data as any).partStudios)
  );
}

function deserializePartStudioV2(data: SerializedPartStudioV2): PartStudio {
  const deserializedSketches = new Map(
    data.sketches.map(([id, sketch]) => [id, deserializeSketch(sketch)])
  );

  return {
    id: data.id,
    name: data.name,
    planes: deserializeMap(data.planes),
    sketches: deserializedSketches,
    opGraph: deserializeMap(data.opGraph),
    opOrder: data.opOrder,
    params: {
      params: deserializeMap(data.params.params),
      errors: deserializeMap(data.params.errors),
    },
    meta: data.meta,
  } as PartStudio;
}

/**
 * Convert legacy Document format to PartStudio.
 * Takes the first PartStudio from the document.
 */
function deserializeFromLegacyDocument(data: SerializedDocumentV1): PartStudio {
  // Get the first part studio
  const [firstStudioEntry] = data.partStudios;
  if (!firstStudioEntry) {
    throw new Error("Legacy document has no part studios");
  }

  const [, legacyStudio] = firstStudioEntry;

  const deserializedSketches = new Map(
    legacyStudio.sketches.map(([id, sketch]) => [id, deserializeSketch(sketch)])
  );

  // Use document-level params if available, otherwise create empty
  const params: ParamEnv = data.params
    ? {
        params: deserializeMap(data.params.params),
        errors: deserializeMap(data.params.errors),
      }
    : {
        params: new Map(),
        errors: new Map(),
      };

  return {
    id: legacyStudio.id,
    name: legacyStudio.name,
    planes: deserializeMap(legacyStudio.planes),
    sketches: deserializedSketches,
    opGraph: deserializeMap(legacyStudio.opGraph),
    opOrder: legacyStudio.opOrder,
    params,
    meta: data.meta,
  } as PartStudio;
}

// ============================================================================
// Store
// ============================================================================

export const useFileStore = create<FileStoreState>()((set, get) => ({
  currentPath: "/",
  contents: [],
  openFilePath: null,
  isLoading: false,
  error: null,

  navigateTo: async (targetPath: string) => {
    const fs = getFs();
    const normalized = path.normalize(targetPath);

    set({ isLoading: true, error: null });

    try {
      // Ensure directory exists
      await fs.mkdir(normalized, { recursive: true });

      // List contents
      const entries = await fs.list(normalized);

      // Get extended metadata (thumbnails) for files
      const entriesWithThumbnails: FileEntry[] = await Promise.all(
        entries.map(async (entry) => {
          if (!entry.isDirectory) {
            const ext = await fs.statExtended(entry.path);
            return { ...entry, thumbnail: ext?.thumbnail };
          }
          return entry;
        })
      );

      set({
        currentPath: normalized,
        contents: entriesWithThumbnails,
        isLoading: false,
      });
    } catch (err) {
      console.error("[FileStore] navigateTo error:", err);
      set({
        error: err instanceof Error ? err.message : "Failed to navigate",
        isLoading: false,
      });
    }
  },

  navigateUp: async () => {
    const { currentPath, navigateTo } = get();
    if (currentPath === "/") return;
    const parent = path.dirname(currentPath);
    await navigateTo(parent);
  },

  refresh: async () => {
    const { currentPath, navigateTo } = get();
    await navigateTo(currentPath);
  },

  createFolder: async (name: string) => {
    const fs = getFs();
    const { currentPath, refresh } = get();

    const folderPath = path.join(currentPath, name);

    try {
      await fs.mkdir(folderPath);
      await refresh();
      return folderPath;
    } catch (err) {
      console.error("[FileStore] createFolder error:", err);
      throw err;
    }
  },

  saveFile: async (name: string, content: string, options) => {
    const fs = getFs();
    const { currentPath, refresh } = get();

    const folder = options?.folder || currentPath;
    const filePath = path.join(folder, name);

    try {
      // Ensure parent directory exists
      await fs.mkdir(folder, { recursive: true });

      // Write file
      await fs.writeText(filePath, content, {
        mimeType: MIME_TYPES.VIBECAD,
        overwrite: true,
      });

      // Update thumbnail if provided
      if (options?.thumbnail) {
        await fs.updateMetadata(filePath, { thumbnail: options.thumbnail });
      }

      await refresh();
      return filePath;
    } catch (err) {
      console.error("[FileStore] saveFile error:", err);
      throw err;
    }
  },

  savePartStudio: async (studio: PartStudio, options) => {
    const fs = getFs();
    const { currentPath, refresh, openFilePath } = get();

    // Determine file path
    let filePath: string;
    if (options?.path) {
      // Save to specific path
      filePath = options.path;
    } else if (openFilePath) {
      // Overwrite currently open file
      filePath = openFilePath;
    } else {
      // New file in current directory
      const fileName = sanitizeFileName(studio.name) + ".vibecad";
      filePath = path.join(currentPath, fileName);
    }

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      await fs.mkdir(parentDir, { recursive: true });

      // Serialize and write
      const serialized = serializePartStudio(studio);
      const content = JSON.stringify(serialized, null, 2);

      await fs.writeText(filePath, content, {
        mimeType: MIME_TYPES.VIBECAD,
        overwrite: true,
      });

      // Update thumbnail if provided
      if (options?.thumbnail) {
        await fs.updateMetadata(filePath, { thumbnail: options.thumbnail });
      }

      set({ openFilePath: filePath });
      await refresh();

      return filePath;
    } catch (err) {
      console.error("[FileStore] savePartStudio error:", err);
      throw err;
    }
  },

  loadPartStudio: async (filePath: string) => {
    const fs = getFs();

    try {
      const content = await fs.readText(filePath);
      if (!content) {
        console.error("[FileStore] File not found:", filePath);
        return null;
      }

      const data = JSON.parse(content);
      const studio = deserializePartStudio(data);

      set({ openFilePath: filePath });

      return studio;
    } catch (err) {
      console.error("[FileStore] loadPartStudio error:", err);
      return null;
    }
  },

  deleteEntry: async (entryPath: string) => {
    const fs = getFs();
    const { refresh, openFilePath } = get();

    try {
      await fs.rm(entryPath);

      // Clear openFilePath if we deleted the open file
      if (openFilePath === entryPath) {
        set({ openFilePath: null });
      }

      await refresh();
    } catch (err) {
      console.error("[FileStore] deleteEntry error:", err);
      throw err;
    }
  },

  renameEntry: async (oldPath: string, newName: string) => {
    const fs = getFs();
    const { refresh, openFilePath } = get();

    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName);

    try {
      await fs.move(oldPath, newPath);

      // Update openFilePath if we renamed the open file
      if (openFilePath === oldPath) {
        set({ openFilePath: newPath });
      }

      await refresh();
    } catch (err) {
      console.error("[FileStore] renameEntry error:", err);
      throw err;
    }
  },

  moveEntry: async (fromPath: string, toPath: string) => {
    const fs = getFs();
    const { refresh, openFilePath } = get();

    try {
      await fs.move(fromPath, toPath);

      // Update openFilePath if we moved the open file
      if (openFilePath === fromPath) {
        set({ openFilePath: toPath });
      }

      await refresh();
    } catch (err) {
      console.error("[FileStore] moveEntry error:", err);
      throw err;
    }
  },

  setOpenFilePath: (filePath: string | null) => {
    set({ openFilePath: filePath });
  },

  getExtendedMetadata: async (filePath: string) => {
    const fs = getFs();
    return fs.statExtended(filePath);
  },

  updateThumbnail: async (filePath: string, thumbnail: string) => {
    const fs = getFs();
    const { refresh } = get();

    try {
      await fs.updateMetadata(filePath, { thumbnail });
      await refresh();
    } catch (err) {
      console.error("[FileStore] updateThumbnail error:", err);
    }
  },
}));

// ============================================================================
// Helpers
// ============================================================================

/**
 * Sanitize a name for use as a filename.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100) || "untitled";
}

/**
 * Initialize the filesystem with default folders.
 */
export async function initializeFileSystem(): Promise<void> {
  const fs = getFs();

  // Create default folders if they don't exist
  await fs.mkdir("/My Parts", { recursive: true });
}

/**
 * Upload a file from the user's computer.
 */
export function uploadFile(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vibecad,.json,.vibecad.json";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const content = await file.text();
        resolve({ name: file.name, content });
      } catch (error) {
        console.error("Failed to read file:", error);
        resolve(null);
      }
    };

    input.click();
  });
}

/**
 * Download content as a file.
 */
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Legacy compatibility exports (for gradual migration)
// ============================================================================

// These help components that still import the old names
export { serializePartStudio as serializeDocument };
export { deserializePartStudio as deserializeDocument };
