/**
 * Tabs Store - manages multiple open documents/tabs
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type DocumentType = "cad" | "image" | "raw" | "text" | "pdf" | "markdown" | "video" | "audio" | "model3d";

interface DocumentBase {
  id: string;
  name: string;
  type: DocumentType;
  icon?: string;
  unsaved?: boolean;
}

export interface CadDocument extends DocumentBase {
  type: "cad";
  // Reference to the CAD document in cad-store
  cadDocumentId: string;
}

export interface ImageDocument extends DocumentBase {
  type: "image";
  // Image data
  src: string; // Data URL or URL
  mimeType: string;
  width?: number;
  height?: number;
}

export interface RawDocument extends DocumentBase {
  type: "raw";
  // Raw file data
  data: string; // Base64 encoded data
  mimeType: string;
  size: number;
  originalFilename: string;
}

export interface TextDocument extends DocumentBase {
  type: "text";
  content: string;
  language: string; // e.g., "javascript", "json", "xml", "css", "plain"
  mimeType: string;
  originalFilename: string;
}

export interface PdfDocument extends DocumentBase {
  type: "pdf";
  src: string; // Data URL
  size: number;
  originalFilename: string;
}

export interface MarkdownDocument extends DocumentBase {
  type: "markdown";
  content: string;
  originalFilename: string;
}

export interface VideoDocument extends DocumentBase {
  type: "video";
  src: string; // Data URL or object URL
  mimeType: string;
  size: number;
  originalFilename: string;
}

export interface AudioDocument extends DocumentBase {
  type: "audio";
  src: string; // Data URL or object URL
  mimeType: string;
  size: number;
  duration?: number;
  originalFilename: string;
}

export interface Model3dDocument extends DocumentBase {
  type: "model3d";
  src: string; // Data URL or object URL
  format: "stl" | "obj" | "gltf" | "glb";
  mimeType: string;
  size: number;
  originalFilename: string;
}

export type TabDocument =
  | CadDocument
  | ImageDocument
  | RawDocument
  | TextDocument
  | PdfDocument
  | MarkdownDocument
  | VideoDocument
  | AudioDocument
  | Model3dDocument;

interface TabsState {
  // All open tabs
  tabs: TabDocument[];
  // Currently active tab ID
  activeTabId: string | null;

  // Actions
  openTab: (doc: TabDocument) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabDocument>) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  getTab: (tabId: string) => TabDocument | undefined;
  markTabUnsaved: (tabId: string, unsaved: boolean) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Store
// ============================================================================

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (doc) => {
        const existingTab = get().tabs.find((t) => t.id === doc.id);

        if (existingTab) {
          // Tab already open, just activate it
          set({ activeTabId: doc.id });
          return;
        }

        set((state) => ({
          tabs: [...state.tabs, doc],
          activeTabId: doc.id,
        }));
      },

      closeTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTabs = state.tabs.filter((t) => t.id !== tabId);

          // Determine new active tab
          let newActiveTabId = state.activeTabId;
          if (state.activeTabId === tabId) {
            if (newTabs.length === 0) {
              newActiveTabId = null;
            } else if (tabIndex >= newTabs.length) {
              // Closed last tab, activate the new last tab
              newActiveTabId = newTabs[newTabs.length - 1].id;
            } else {
              // Activate the tab at the same index
              newActiveTabId = newTabs[tabIndex].id;
            }
          }

          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
          };
        });
      },

      setActiveTab: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        if (tab) {
          set({ activeTabId: tabId });
        }
      },

      updateTab: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? ({ ...t, ...updates } as TabDocument) : t
          ),
        }));
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.tabs];
          const [removed] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, removed);
          return { tabs: newTabs };
        });
      },

      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null });
      },

      closeOtherTabs: (tabId) => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id === tabId),
          activeTabId: tabId,
        }));
      },

      getTab: (tabId) => {
        return get().tabs.find((t) => t.id === tabId);
      },

      markTabUnsaved: (tabId, unsaved) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, unsaved } : t
          ),
        }));
      },
    }),
    {
      name: "vibecad-tabs",
      partialize: (state) => ({
        // Only persist tab metadata, not actual content for images/raw
        tabs: state.tabs.map((t) => {
          if (t.type === "cad") {
            return t;
          }
          // For other types, only persist metadata (data will need to be reloaded)
          return {
            ...t,
            src: t.type === "image" ? undefined : undefined,
            data: t.type === "raw" ? undefined : undefined,
          };
        }).filter((t) => t.type === "cad"), // Only persist CAD tabs
        activeTabId: state.activeTabId,
      }),
    }
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new CAD document tab
 */
export function createCadTab(name: string, cadDocumentId: string): CadDocument {
  return {
    id: generateTabId(),
    name,
    type: "cad",
    cadDocumentId,
    icon: "cube",
  };
}

/**
 * Create a new image document tab from a file
 */
export async function createImageTabFromFile(file: File): Promise<ImageDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        resolve({
          id: generateTabId(),
          name: file.name,
          type: "image",
          src,
          mimeType: file.type,
          width: img.width,
          height: img.height,
          icon: "image",
        });
      };
      img.onerror = () => {
        // Still create tab even if we can't get dimensions
        resolve({
          id: generateTabId(),
          name: file.name,
          type: "image",
          src,
          mimeType: file.type,
          icon: "image",
        });
      };
      img.src = src;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Create a new raw file document tab
 */
export async function createRawTabFromFile(file: File): Promise<RawDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = (e.target?.result as string).split(",")[1] || ""; // Remove data URL prefix
      resolve({
        id: generateTabId(),
        name: file.name,
        type: "raw",
        data,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        originalFilename: file.name,
        icon: "file",
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Create a new text document tab from a file
 */
export async function createTextTabFromFile(file: File): Promise<TextDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve({
        id: generateTabId(),
        name: file.name,
        type: "text",
        content,
        language: getLanguageFromFilename(file.name),
        mimeType: file.type || "text/plain",
        originalFilename: file.name,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Create a new PDF document tab from a file
 */
export async function createPdfTabFromFile(file: File): Promise<PdfDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      resolve({
        id: generateTabId(),
        name: file.name,
        type: "pdf",
        src,
        size: file.size,
        originalFilename: file.name,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Create a new markdown document tab from a file
 */
export async function createMarkdownTabFromFile(file: File): Promise<MarkdownDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve({
        id: generateTabId(),
        name: file.name,
        type: "markdown",
        content,
        originalFilename: file.name,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Create a new video document tab from a file
 */
export async function createVideoTabFromFile(file: File): Promise<VideoDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      resolve({
        id: generateTabId(),
        name: file.name,
        type: "video",
        src,
        mimeType: file.type || "video/mp4",
        size: file.size,
        originalFilename: file.name,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Create a new audio document tab from a file
 */
export async function createAudioTabFromFile(file: File): Promise<AudioDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      resolve({
        id: generateTabId(),
        name: file.name,
        type: "audio",
        src,
        mimeType: file.type || "audio/mpeg",
        size: file.size,
        originalFilename: file.name,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Create a new 3D model document tab from a file
 */
export async function createModel3dTabFromFile(file: File): Promise<Model3dDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const format = get3dModelFormat(file.name);
      resolve({
        id: generateTabId(),
        name: file.name,
        type: "model3d",
        src,
        format,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        originalFilename: file.name,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Get language identifier from filename for syntax highlighting
 */
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    xml: "xml",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    py: "python",
    rb: "ruby",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "ini",
    conf: "ini",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    svelte: "svelte",
    vue: "vue",
    md: "markdown",
    txt: "plain",
  };
  return languageMap[ext] || "plain";
}

/**
 * Get 3D model format from filename
 */
function get3dModelFormat(filename: string): "stl" | "obj" | "gltf" | "glb" {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "stl") return "stl";
  if (ext === "obj") return "obj";
  if (ext === "gltf") return "gltf";
  if (ext === "glb") return "glb";
  return "stl"; // default
}

/**
 * Determine document type from file
 */
export function getDocumentTypeFromFile(file: File): DocumentType {
  const lowerName = file.name.toLowerCase();
  const ext = lowerName.split(".").pop() || "";

  // Image types
  const imageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
  if (imageTypes.includes(file.type)) {
    return "image";
  }

  // vibeCAD files
  const cadExtensions = [".vibecad.json", ".vibecad"];
  if (cadExtensions.some((e) => lowerName.endsWith(e))) {
    return "cad";
  }

  // PDF
  if (file.type === "application/pdf" || ext === "pdf") {
    return "pdf";
  }

  // Video
  const videoTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo"];
  const videoExts = ["mp4", "webm", "ogg", "ogv", "mov", "avi", "mkv"];
  if (videoTypes.includes(file.type) || videoExts.includes(ext)) {
    return "video";
  }

  // Audio
  const audioTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"];
  const audioExts = ["mp3", "wav", "ogg", "oga", "webm", "aac", "flac", "m4a"];
  if (audioTypes.includes(file.type) || audioExts.includes(ext)) {
    return "audio";
  }

  // 3D models (standalone viewer, not vibeCAD)
  const model3dExts = ["stl", "obj", "gltf", "glb"];
  if (model3dExts.includes(ext)) {
    return "model3d";
  }

  // Markdown
  const markdownExts = ["md", "markdown", "mdown", "mkd"];
  if (markdownExts.includes(ext)) {
    return "markdown";
  }

  // Text/Code files
  const textTypes = [
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "application/json",
    "application/xml",
    "text/xml",
    "application/javascript",
    "text/typescript",
  ];
  const textExts = [
    "txt", "js", "jsx", "ts", "tsx", "json", "xml", "html", "htm", "css", "scss", "less",
    "py", "rb", "rs", "go", "java", "c", "cpp", "h", "hpp", "cs", "php", "sh", "bash",
    "zsh", "yaml", "yml", "toml", "ini", "conf", "sql", "graphql", "gql", "svelte", "vue",
    "env", "gitignore", "dockerignore", "editorconfig", "eslintrc", "prettierrc",
  ];
  if (textTypes.includes(file.type) || textExts.includes(ext)) {
    return "text";
  }

  return "raw";
}
