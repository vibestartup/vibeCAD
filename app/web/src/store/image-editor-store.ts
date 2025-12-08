/**
 * Image Editor Store - manages drawing tools and canvas state for ImageViewer
 */

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export type DrawingTool =
  | "select"
  | "pen"
  | "brush"
  | "eraser"
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "text"
  | "eyedropper";

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingStroke {
  id: string;
  tool: DrawingTool;
  points: DrawingPoint[];
  color: string;
  size: number;
  opacity: number;
  // For shapes
  startPoint?: DrawingPoint;
  endPoint?: DrawingPoint;
  // For text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface ImageEditorState {
  // Active tool
  activeTool: DrawingTool;
  setActiveTool: (tool: DrawingTool) => void;

  // Tool settings
  strokeColor: string;
  setStrokeColor: (color: string) => void;

  fillColor: string;
  setFillColor: (color: string) => void;

  strokeSize: number;
  setStrokeSize: (size: number) => void;

  opacity: number;
  setOpacity: (opacity: number) => void;

  // Brush-specific
  brushHardness: number;
  setBrushHardness: (hardness: number) => void;

  // Text-specific
  fontSize: number;
  setFontSize: (size: number) => void;

  fontFamily: string;
  setFontFamily: (family: string) => void;

  // Shape-specific
  fillEnabled: boolean;
  setFillEnabled: (enabled: boolean) => void;

  strokeEnabled: boolean;
  setStrokeEnabled: (enabled: boolean) => void;

  // Arrow-specific
  arrowHeadSize: number;
  setArrowHeadSize: (size: number) => void;

  // Drawing state
  strokes: DrawingStroke[];
  addStroke: (stroke: DrawingStroke) => void;
  removeStroke: (id: string) => void;
  clearStrokes: () => void;

  // Undo/Redo
  undoStack: DrawingStroke[][];
  redoStack: DrawingStroke[][];
  undo: () => void;
  redo: () => void;
  pushUndoState: () => void;

  // Current drawing
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;

  currentStroke: DrawingStroke | null;
  setCurrentStroke: (stroke: DrawingStroke | null) => void;

  // Picked color (from eyedropper)
  pickedColor: string | null;
  setPickedColor: (color: string | null) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Store
// ============================================================================

const initialState = {
  activeTool: "select" as DrawingTool,
  strokeColor: "#ff0000",
  fillColor: "#ffffff",
  strokeSize: 4,
  opacity: 100,
  brushHardness: 100,
  fontSize: 24,
  fontFamily: "Arial",
  fillEnabled: false,
  strokeEnabled: true,
  arrowHeadSize: 12,
  strokes: [] as DrawingStroke[],
  undoStack: [] as DrawingStroke[][],
  redoStack: [] as DrawingStroke[][],
  isDrawing: false,
  currentStroke: null as DrawingStroke | null,
  pickedColor: null as string | null,
};

export const useImageEditorStore = create<ImageEditorState>((set, get) => ({
  ...initialState,

  setActiveTool: (tool) => set({ activeTool: tool }),

  setStrokeColor: (color) => set({ strokeColor: color }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeSize: (size) => set({ strokeSize: Math.max(1, Math.min(100, size)) }),
  setOpacity: (opacity) => set({ opacity: Math.max(0, Math.min(100, opacity)) }),

  setBrushHardness: (hardness) => set({ brushHardness: Math.max(0, Math.min(100, hardness)) }),

  setFontSize: (size) => set({ fontSize: Math.max(8, Math.min(200, size)) }),
  setFontFamily: (family) => set({ fontFamily: family }),

  setFillEnabled: (enabled) => set({ fillEnabled: enabled }),
  setStrokeEnabled: (enabled) => set({ strokeEnabled: enabled }),

  setArrowHeadSize: (size) => set({ arrowHeadSize: Math.max(4, Math.min(50, size)) }),

  addStroke: (stroke) =>
    set((state) => ({
      strokes: [...state.strokes, stroke],
      redoStack: [], // Clear redo on new action
    })),

  removeStroke: (id) =>
    set((state) => ({
      strokes: state.strokes.filter((s) => s.id !== id),
    })),

  clearStrokes: () => {
    const state = get();
    if (state.strokes.length > 0) {
      state.pushUndoState();
    }
    set({ strokes: [], redoStack: [] });
  },

  pushUndoState: () =>
    set((state) => ({
      undoStack: [...state.undoStack, [...state.strokes]].slice(-50), // Keep last 50 states
    })),

  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const previous = state.undoStack[state.undoStack.length - 1];
      return {
        strokes: previous,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.strokes],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        strokes: next,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.strokes],
      };
    }),

  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  setCurrentStroke: (stroke) => set({ currentStroke: stroke }),

  setPickedColor: (color) => set({ pickedColor: color }),

  reset: () => set(initialState),
}));

// ============================================================================
// Helper to generate stroke IDs
// ============================================================================

export function generateStrokeId(): string {
  return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Tool definitions for UI
// ============================================================================

export interface ToolDefinition {
  id: DrawingTool;
  label: string;
  icon: string;
  shortcut?: string;
  description: string;
}

export const drawingTools: ToolDefinition[] = [
  { id: "select", label: "Select", icon: "↖", shortcut: "V", description: "Select and move annotations" },
  { id: "pen", label: "Pen", icon: "✎", shortcut: "P", description: "Draw freehand lines" },
  { id: "brush", label: "Brush", icon: "🖌", shortcut: "B", description: "Paint with soft edges" },
  { id: "eraser", label: "Eraser", icon: "⌫", shortcut: "E", description: "Erase annotations" },
  { id: "line", label: "Line", icon: "╱", shortcut: "L", description: "Draw straight lines" },
  { id: "arrow", label: "Arrow", icon: "→", shortcut: "A", description: "Draw arrows" },
  { id: "rectangle", label: "Rectangle", icon: "▢", shortcut: "R", description: "Draw rectangles" },
  { id: "ellipse", label: "Ellipse", icon: "○", shortcut: "O", description: "Draw ellipses/circles" },
  { id: "text", label: "Text", icon: "T", shortcut: "T", description: "Add text annotations" },
  { id: "eyedropper", label: "Eyedropper", icon: "💧", shortcut: "I", description: "Pick color from image" },
];

export const fontFamilies = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Impact",
  "Comic Sans MS",
];
