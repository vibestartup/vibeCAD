/**
 * Tabs Store - manages multiple open documents/tabs
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type DocumentType = "cad" | "image" | "raw";

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

export type TabDocument = CadDocument | ImageDocument | RawDocument;

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
 * Determine document type from file
 */
export function getDocumentTypeFromFile(file: File): DocumentType {
  const imageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
  const cadExtensions = [".vibecad.json", ".step", ".stp", ".iges", ".igs"];

  if (imageTypes.includes(file.type)) {
    return "image";
  }

  const lowerName = file.name.toLowerCase();
  if (cadExtensions.some((ext) => lowerName.endsWith(ext))) {
    return "cad";
  }

  return "raw";
}
