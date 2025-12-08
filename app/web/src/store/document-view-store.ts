/**
 * Document View Store - stores per-document view state like camera position,
 * timeline position, editor mode, etc.
 *
 * This is separate from cad-store because view state is per-tab/document,
 * while cad-store holds the "active" document.
 */

import { create } from "zustand";
import type { PartStudio } from "@vibecad/core";
import type { EditorMode } from "./cad-store";

// ============================================================================
// Types
// ============================================================================

/** Camera state for 3D viewport */
export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom: number;
  isOrthographic: boolean;
}

/** Per-document view state */
export interface DocumentViewState {
  // The actual document data
  studio: PartStudio;

  // Camera
  camera: CameraState;

  // Timeline / rollback position (null = show all)
  timelinePosition: number | null;

  // Editor mode
  editorMode: EditorMode;

  // Active sketch (when in sketch mode)
  activeSketchId: string | null;

  // Selections
  objectSelection: Set<string>;
  opSelection: Set<string>;
}

/** Default camera state */
export const DEFAULT_CAMERA_STATE: CameraState = {
  position: { x: 150, y: 150, z: 150 },
  target: { x: 0, y: 0, z: 0 },
  zoom: 1,
  isOrthographic: false,
};

/** Create default view state for a studio */
export function createDefaultViewState(studio: PartStudio): DocumentViewState {
  return {
    studio,
    camera: { ...DEFAULT_CAMERA_STATE },
    timelinePosition: null,
    editorMode: "object",
    activeSketchId: null,
    objectSelection: new Set(),
    opSelection: new Set(),
  };
}

// ============================================================================
// Store
// ============================================================================

interface DocumentViewStoreState {
  /** Map of cadDocumentId -> DocumentViewState */
  documents: Map<string, DocumentViewState>;

  /** Currently active document ID */
  activeDocumentId: string | null;

  // Actions
  /** Set the active document, loading its view state */
  setActiveDocument: (docId: string | null) => void;

  /** Get view state for a document */
  getDocumentState: (docId: string) => DocumentViewState | undefined;

  /** Create/initialize a new document */
  initDocument: (docId: string, studio: PartStudio) => void;

  /** Update studio for a document */
  updateStudio: (docId: string, studio: PartStudio) => void;

  /** Update camera state for current document */
  updateCamera: (camera: Partial<CameraState>) => void;

  /** Update timeline position for current document */
  updateTimelinePosition: (position: number | null) => void;

  /** Update editor mode for current document */
  updateEditorMode: (mode: EditorMode) => void;

  /** Update active sketch for current document */
  updateActiveSketch: (sketchId: string | null) => void;

  /** Update object selection for current document */
  updateObjectSelection: (selection: Set<string>) => void;

  /** Update op selection for current document */
  updateOpSelection: (selection: Set<string>) => void;

  /** Remove a document from the store */
  removeDocument: (docId: string) => void;

  /** Get the active document's view state */
  getActiveDocumentState: () => DocumentViewState | undefined;
}

export const useDocumentViewStore = create<DocumentViewStoreState>((set, get) => ({
  documents: new Map(),
  activeDocumentId: null,

  setActiveDocument: (docId) => {
    set({ activeDocumentId: docId });
  },

  getDocumentState: (docId) => {
    return get().documents.get(docId);
  },

  initDocument: (docId, studio) => {
    const { documents } = get();
    if (!documents.has(docId)) {
      const newDocs = new Map(documents);
      newDocs.set(docId, createDefaultViewState(studio));
      set({ documents: newDocs });
    }
  },

  updateStudio: (docId, studio) => {
    const { documents } = get();
    const existing = documents.get(docId);
    if (existing) {
      const newDocs = new Map(documents);
      newDocs.set(docId, { ...existing, studio });
      set({ documents: newDocs });
    }
  },

  updateCamera: (camera) => {
    const { documents, activeDocumentId } = get();
    if (!activeDocumentId) return;

    const existing = documents.get(activeDocumentId);
    if (existing) {
      const newDocs = new Map(documents);
      newDocs.set(activeDocumentId, {
        ...existing,
        camera: { ...existing.camera, ...camera },
      });
      set({ documents: newDocs });
    }
  },

  updateTimelinePosition: (position) => {
    const { documents, activeDocumentId } = get();
    if (!activeDocumentId) return;

    const existing = documents.get(activeDocumentId);
    if (existing) {
      const newDocs = new Map(documents);
      newDocs.set(activeDocumentId, { ...existing, timelinePosition: position });
      set({ documents: newDocs });
    }
  },

  updateEditorMode: (mode) => {
    const { documents, activeDocumentId } = get();
    if (!activeDocumentId) return;

    const existing = documents.get(activeDocumentId);
    if (existing) {
      const newDocs = new Map(documents);
      newDocs.set(activeDocumentId, { ...existing, editorMode: mode });
      set({ documents: newDocs });
    }
  },

  updateActiveSketch: (sketchId) => {
    const { documents, activeDocumentId } = get();
    if (!activeDocumentId) return;

    const existing = documents.get(activeDocumentId);
    if (existing) {
      const newDocs = new Map(documents);
      newDocs.set(activeDocumentId, { ...existing, activeSketchId: sketchId });
      set({ documents: newDocs });
    }
  },

  updateObjectSelection: (selection) => {
    const { documents, activeDocumentId } = get();
    if (!activeDocumentId) return;

    const existing = documents.get(activeDocumentId);
    if (existing) {
      const newDocs = new Map(documents);
      newDocs.set(activeDocumentId, { ...existing, objectSelection: selection });
      set({ documents: newDocs });
    }
  },

  updateOpSelection: (selection) => {
    const { documents, activeDocumentId } = get();
    if (!activeDocumentId) return;

    const existing = documents.get(activeDocumentId);
    if (existing) {
      const newDocs = new Map(documents);
      newDocs.set(activeDocumentId, { ...existing, opSelection: selection });
      set({ documents: newDocs });
    }
  },

  removeDocument: (docId) => {
    const { documents, activeDocumentId } = get();
    const newDocs = new Map(documents);
    newDocs.delete(docId);
    set({
      documents: newDocs,
      activeDocumentId: activeDocumentId === docId ? null : activeDocumentId,
    });
  },

  getActiveDocumentState: () => {
    const { documents, activeDocumentId } = get();
    if (!activeDocumentId) return undefined;
    return documents.get(activeDocumentId);
  },
}));
