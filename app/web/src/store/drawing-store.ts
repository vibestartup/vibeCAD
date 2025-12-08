/**
 * Drawing Store - global state management for 2D technical drawings.
 */

import { create } from "zustand";
import type {
  DrawingViewId,
  DrawingDimId,
  DrawingAnnotationId,
  ViewProjection,
  Vec2,
  PartStudio,
  DrawingSheetSize,
} from "@vibecad/core";
import {
  createDrawing,
  createDrawingView,
  addView,
  updateView,
  removeView,
  addDimension,
  removeDimension,
  addAnnotation,
  removeAnnotation,
  touchDrawing,
  createTextAnnotation,
  createLinearDimension,
} from "@vibecad/core";
import type {
  Drawing,
  DrawingView,
  DrawingDimension,
  DrawingAnnotation,
} from "@vibecad/core";

// Use DrawingSheetSize (renamed to avoid conflict with schematic sheet)
type SheetSize = DrawingSheetSize;
import type { Kernel } from "@vibecad/kernel";

// ============================================================================
// Types
// ============================================================================

export type DrawingEditorMode =
  | "select" // Default selection mode
  | "pan" // Pan the view
  | "place-view" // Placing a new view
  | "dimension-linear" // Adding linear dimension
  | "dimension-diameter" // Adding diameter dimension
  | "dimension-radius" // Adding radius dimension
  | "dimension-angle" // Adding angle dimension
  | "annotate-text" // Adding text annotation
  | "annotate-note"; // Adding note with leader

export type DrawingTool =
  | "select"
  | "pan"
  | "view"
  | "dim-linear"
  | "dim-diameter"
  | "dim-radius"
  | "dim-angle"
  | "text"
  | "note"
  | "balloon";

// Cached source geometry
export interface SourceCache {
  path: string;
  studio: PartStudio;
  shapeHandle?: number;
  lastModified: number;
}

// ============================================================================
// State Interface
// ============================================================================

interface DrawingState {
  // Main drawing data
  drawing: Drawing;

  // Source geometry cache (loaded .vibecad files)
  sourceCache: Map<string, SourceCache>;

  // Editor state
  editorMode: DrawingEditorMode;
  activeTool: DrawingTool;

  // Selection
  selectedViews: Set<DrawingViewId>;
  selectedDimensions: Set<DrawingDimId>;
  selectedAnnotations: Set<DrawingAnnotationId>;

  // Hover state
  hoveredView: DrawingViewId | null;
  hoveredDimension: DrawingDimId | null;
  hoveredAnnotation: DrawingAnnotationId | null;

  // Sheet view state
  sheetZoom: number;
  sheetPan: Vec2;

  // Pending view placement
  pendingViewPlacement: {
    sourcePath: string;
    projection: ViewProjection;
    scale: number;
  } | null;

  // Pending dimension (first point selected)
  pendingDimension: {
    type: "linear" | "diameter" | "radius" | "angle";
    firstPoint?: {
      viewId: DrawingViewId;
      position: Vec2;
    };
  } | null;

  // Kernel reference for projection
  kernel: Kernel | null;

  // Is currently recomputing views
  isRecomputing: boolean;
}

interface DrawingActions {
  // Drawing management
  setDrawing: (drawing: Drawing) => void;
  newDrawing: (name?: string, sheetSize?: SheetSize) => void;
  setSheetSize: (size: SheetSize) => void;

  // View management
  addView: (view: DrawingView) => void;
  updateView: (viewId: DrawingViewId, updates: Partial<DrawingView>) => void;
  removeView: (viewId: DrawingViewId) => void;
  setViewProjection: (viewId: DrawingViewId, projection: ViewProjection) => void;
  setViewScale: (viewId: DrawingViewId, scale: number) => void;
  setViewPosition: (viewId: DrawingViewId, position: Vec2) => void;

  // Dimension management
  addDimension: (dim: DrawingDimension) => void;
  updateDimension: (dimId: DrawingDimId, updates: Partial<DrawingDimension>) => void;
  removeDimension: (dimId: DrawingDimId) => void;

  // Annotation management
  addAnnotation: (ann: DrawingAnnotation) => void;
  removeAnnotation: (annId: DrawingAnnotationId) => void;

  // Selection
  selectView: (viewId: DrawingViewId, addToSelection?: boolean) => void;
  selectDimension: (dimId: DrawingDimId, addToSelection?: boolean) => void;
  selectAnnotation: (annId: DrawingAnnotationId, addToSelection?: boolean) => void;
  clearSelection: () => void;
  deleteSelected: () => void;

  // Hover
  setHoveredView: (viewId: DrawingViewId | null) => void;
  setHoveredDimension: (dimId: DrawingDimId | null) => void;
  setHoveredAnnotation: (annId: DrawingAnnotationId | null) => void;

  // Editor mode & tools
  setEditorMode: (mode: DrawingEditorMode) => void;
  setActiveTool: (tool: DrawingTool) => void;

  // Sheet navigation
  setSheetZoom: (zoom: number) => void;
  setSheetPan: (pan: Vec2) => void;
  zoomToFit: () => void;

  // View placement workflow
  startViewPlacement: (sourcePath: string, projection?: ViewProjection, scale?: number) => void;
  cancelViewPlacement: () => void;
  confirmViewPlacement: (position: Vec2) => void;

  // Dimension workflow
  startDimension: (type: "linear" | "diameter" | "radius" | "angle") => void;
  setDimensionFirstPoint: (viewId: DrawingViewId, position: Vec2) => void;
  confirmDimension: (secondPoint: Vec2) => void;
  cancelDimension: () => void;

  // Source management
  loadSource: (path: string, studio: PartStudio, shapeHandle?: number) => void;
  clearSourceCache: () => void;

  // Kernel
  setKernel: (kernel: Kernel) => void;

  // Recompute all views (manual trigger)
  recomputeViews: () => Promise<void>;
}

type DrawingStore = DrawingState & DrawingActions;

// ============================================================================
// Store Implementation
// ============================================================================

export const useDrawingStore = create<DrawingStore>((set, get) => ({
  // Initial state
  drawing: createDrawing("Untitled Drawing"),
  sourceCache: new Map(),
  editorMode: "select",
  activeTool: "select",
  selectedViews: new Set(),
  selectedDimensions: new Set(),
  selectedAnnotations: new Set(),
  hoveredView: null,
  hoveredDimension: null,
  hoveredAnnotation: null,
  sheetZoom: 1,
  sheetPan: [0, 0],
  pendingViewPlacement: null,
  pendingDimension: null,
  kernel: null,
  isRecomputing: false,

  // Drawing management
  setDrawing: (drawing) => set({ drawing }),

  newDrawing: (name = "Untitled Drawing", sheetSize = "A3") => {
    set({
      drawing: createDrawing(name, sheetSize),
      sourceCache: new Map(),
      selectedViews: new Set(),
      selectedDimensions: new Set(),
      selectedAnnotations: new Set(),
      sheetZoom: 1,
      sheetPan: [0, 0],
    });
  },

  setSheetSize: (size) => {
    set((state) => {
      const sheet = state.drawing.sheet;
      const SHEET_SIZES: Record<string, { width: number; height: number }> = {
        A4: { width: 210, height: 297 },
        A3: { width: 297, height: 420 },
        A2: { width: 420, height: 594 },
        A1: { width: 594, height: 841 },
        A0: { width: 841, height: 1189 },
        Letter: { width: 216, height: 279 },
        Tabloid: { width: 279, height: 432 },
      };
      const dims = SHEET_SIZES[size] || { width: 297, height: 420 };
      const isLandscape = sheet.orientation === "landscape";
      return {
        drawing: touchDrawing({
          ...state.drawing,
          sheet: {
            ...sheet,
            size,
            width: isLandscape ? Math.max(dims.width, dims.height) : Math.min(dims.width, dims.height),
            height: isLandscape ? Math.min(dims.width, dims.height) : Math.max(dims.width, dims.height),
          },
        }),
      };
    });
  },

  // View management
  addView: (view) => {
    set((state) => ({
      drawing: addView(state.drawing, view),
    }));
  },

  updateView: (viewId, updates) => {
    set((state) => ({
      drawing: updateView(state.drawing, viewId, updates),
    }));
  },

  removeView: (viewId) => {
    set((state) => ({
      drawing: removeView(state.drawing, viewId),
      selectedViews: new Set([...state.selectedViews].filter((id) => id !== viewId)),
    }));
  },

  setViewProjection: (viewId, projection) => {
    get().updateView(viewId, { projection });
  },

  setViewScale: (viewId, scale) => {
    get().updateView(viewId, { scale });
  },

  setViewPosition: (viewId, position) => {
    get().updateView(viewId, { position });
  },

  // Dimension management
  addDimension: (dim) => {
    set((state) => ({
      drawing: addDimension(state.drawing, dim),
    }));
  },

  updateDimension: (dimId, updates) => {
    set((state) => {
      const dim = state.drawing.dimensions.get(dimId);
      if (!dim) return state;
      const newDims = new Map(state.drawing.dimensions);
      newDims.set(dimId, { ...dim, ...updates } as DrawingDimension);
      return {
        drawing: touchDrawing({ ...state.drawing, dimensions: newDims }),
      };
    });
  },

  removeDimension: (dimId) => {
    set((state) => ({
      drawing: removeDimension(state.drawing, dimId),
      selectedDimensions: new Set([...state.selectedDimensions].filter((id) => id !== dimId)),
    }));
  },

  // Annotation management
  addAnnotation: (ann) => {
    set((state) => ({
      drawing: addAnnotation(state.drawing, ann),
    }));
  },

  removeAnnotation: (annId) => {
    set((state) => ({
      drawing: removeAnnotation(state.drawing, annId),
      selectedAnnotations: new Set([...state.selectedAnnotations].filter((id) => id !== annId)),
    }));
  },

  // Selection
  selectView: (viewId, addToSelection = false) => {
    set((state) => {
      const newSelection = addToSelection ? new Set(state.selectedViews) : new Set<DrawingViewId>();
      newSelection.add(viewId);
      return {
        selectedViews: newSelection,
        selectedDimensions: addToSelection ? state.selectedDimensions : new Set(),
        selectedAnnotations: addToSelection ? state.selectedAnnotations : new Set(),
      };
    });
  },

  selectDimension: (dimId, addToSelection = false) => {
    set((state) => {
      const newSelection = addToSelection ? new Set(state.selectedDimensions) : new Set<DrawingDimId>();
      newSelection.add(dimId);
      return {
        selectedDimensions: newSelection,
        selectedViews: addToSelection ? state.selectedViews : new Set(),
        selectedAnnotations: addToSelection ? state.selectedAnnotations : new Set(),
      };
    });
  },

  selectAnnotation: (annId, addToSelection = false) => {
    set((state) => {
      const newSelection = addToSelection
        ? new Set(state.selectedAnnotations)
        : new Set<DrawingAnnotationId>();
      newSelection.add(annId);
      return {
        selectedAnnotations: newSelection,
        selectedViews: addToSelection ? state.selectedViews : new Set(),
        selectedDimensions: addToSelection ? state.selectedDimensions : new Set(),
      };
    });
  },

  clearSelection: () => {
    set({
      selectedViews: new Set(),
      selectedDimensions: new Set(),
      selectedAnnotations: new Set(),
    });
  },

  deleteSelected: () => {
    const state = get();

    // Delete selected views
    let drawing = state.drawing;
    for (const viewId of state.selectedViews) {
      drawing = removeView(drawing, viewId);
    }

    // Delete selected dimensions
    for (const dimId of state.selectedDimensions) {
      drawing = removeDimension(drawing, dimId);
    }

    // Delete selected annotations
    for (const annId of state.selectedAnnotations) {
      drawing = removeAnnotation(drawing, annId);
    }

    set({
      drawing,
      selectedViews: new Set(),
      selectedDimensions: new Set(),
      selectedAnnotations: new Set(),
    });
  },

  // Hover
  setHoveredView: (viewId) => set({ hoveredView: viewId }),
  setHoveredDimension: (dimId) => set({ hoveredDimension: dimId }),
  setHoveredAnnotation: (annId) => set({ hoveredAnnotation: annId }),

  // Editor mode & tools
  setEditorMode: (mode) => set({ editorMode: mode }),

  setActiveTool: (tool) => {
    const modeMap: Record<DrawingTool, DrawingEditorMode> = {
      select: "select",
      pan: "pan",
      view: "place-view",
      "dim-linear": "dimension-linear",
      "dim-diameter": "dimension-diameter",
      "dim-radius": "dimension-radius",
      "dim-angle": "dimension-angle",
      text: "annotate-text",
      note: "annotate-note",
      balloon: "annotate-note",
    };
    set({
      activeTool: tool,
      editorMode: modeMap[tool] || "select",
    });
  },

  // Sheet navigation
  setSheetZoom: (zoom) => set({ sheetZoom: Math.max(0.1, Math.min(10, zoom)) }),
  setSheetPan: (pan) => set({ sheetPan: pan }),

  zoomToFit: () => {
    // Will be implemented by the canvas component
    set({ sheetZoom: 1, sheetPan: [0, 0] });
  },

  // View placement workflow
  startViewPlacement: (sourcePath, projection = "front", scale = 1) => {
    set({
      pendingViewPlacement: { sourcePath, projection, scale },
      editorMode: "place-view",
      activeTool: "view",
    });
  },

  cancelViewPlacement: () => {
    set({
      pendingViewPlacement: null,
      editorMode: "select",
      activeTool: "select",
    });
  },

  confirmViewPlacement: (position) => {
    const state = get();
    if (!state.pendingViewPlacement) return;

    const { sourcePath, projection, scale } = state.pendingViewPlacement;
    const view = createDrawingView(`View ${state.drawing.views.size + 1}`, sourcePath, projection, position, scale);

    set((s) => ({
      drawing: addView(s.drawing, view),
      pendingViewPlacement: null,
      editorMode: "select",
      activeTool: "select",
    }));
  },

  // Dimension workflow
  startDimension: (type) => {
    set({
      pendingDimension: { type },
      editorMode:
        type === "linear"
          ? "dimension-linear"
          : type === "diameter"
          ? "dimension-diameter"
          : type === "radius"
          ? "dimension-radius"
          : "dimension-angle",
    });
  },

  setDimensionFirstPoint: (viewId, position) => {
    set((state) => ({
      pendingDimension: state.pendingDimension
        ? { ...state.pendingDimension, firstPoint: { viewId, position } }
        : null,
    }));
  },

  confirmDimension: (secondPoint) => {
    const state = get();
    if (!state.pendingDimension?.firstPoint) return;

    const { type, firstPoint } = state.pendingDimension;

    if (type === "linear") {
      const dim = createLinearDimension(
        {
          viewId: firstPoint.viewId,
          type: "explicit",
          explicit: firstPoint.position,
        },
        {
          viewId: firstPoint.viewId,
          type: "explicit",
          explicit: secondPoint,
        },
        "aligned",
        10
      );
      get().addDimension(dim);
    }

    set({
      pendingDimension: null,
      editorMode: "select",
    });
  },

  cancelDimension: () => {
    set({
      pendingDimension: null,
      editorMode: "select",
      activeTool: "select",
    });
  },

  // Source management
  loadSource: (path, studio, shapeHandle) => {
    set((state) => {
      const newCache = new Map(state.sourceCache);
      newCache.set(path, {
        path,
        studio,
        shapeHandle,
        lastModified: Date.now(),
      });
      return { sourceCache: newCache };
    });
  },

  clearSourceCache: () => {
    set({ sourceCache: new Map() });
  },

  // Kernel
  setKernel: (kernel) => set({ kernel }),

  // Recompute views (stub - will be implemented with projection logic)
  recomputeViews: async () => {
    set({ isRecomputing: true });

    // TODO: Implement actual view projection using OCC
    // For each view:
    // 1. Load source geometry from cache or file
    // 2. Project to 2D using HLRBRep
    // 3. Store projected edges in view.projectionResult

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 100));

    set({ isRecomputing: false });
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectDrawing = (state: DrawingStore) => state.drawing;
export const selectViews = (state: DrawingStore) => state.drawing.views;
export const selectDimensions = (state: DrawingStore) => state.drawing.dimensions;
export const selectAnnotations = (state: DrawingStore) => state.drawing.annotations;
export const selectSheet = (state: DrawingStore) => state.drawing.sheet;
export const selectSelectedViews = (state: DrawingStore) => state.selectedViews;
export const selectEditorMode = (state: DrawingStore) => state.editorMode;
export const selectActiveTool = (state: DrawingStore) => state.activeTool;
