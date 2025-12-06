/**
 * CAD Store - global state management using Zustand.
 */

import { create } from "zustand";
import type {
  Document,
  PartStudioId,
  SketchId,
  SketchPlaneId,
  ParamEnv,
  OpId,
  Op,
  ParamId,
  Parameter,
  SketchOp,
  ExtrudeOp,
  PrimitiveId,
  PointPrimitive,
  LinePrimitive,
  CirclePrimitive,
  ArcPrimitive,
  Sketch,
} from "@vibecad/core";
import {
  createDocumentWithCube,
  getDefaultStudio,
  createParam,
  createSketch,
  newId,
  dimLiteral,
  DATUM_XY,
} from "@vibecad/core";
import { history, HistoryState, createHistory, pushState, undo, redo } from "@vibecad/core";
import { params } from "@vibecad/core";
import type { Kernel } from "@vibecad/kernel";

// ============================================================================
// Store State
// ============================================================================

export type EditorMode = "object" | "select-plane" | "sketch";

interface CadState {
  // Document state
  document: Document;
  historyState: HistoryState<Document>;

  // UI state
  activeStudioId: PartStudioId | null;
  activeSketchId: SketchId | null;
  selection: Set<string>;

  // Editor mode
  editorMode: EditorMode;

  // Timeline state - which operation index to evaluate up to (null = all)
  timelinePosition: number | null;

  // Active tool
  activeTool: string;

  // Rebuild state
  isRebuilding: boolean;
  rebuildError: string | null;

  // Kernel reference (set after loading)
  kernel: Kernel | null;
}

interface CadActions {
  // Document actions
  setDocument: (doc: Document) => void;
  updateDocument: (updater: (doc: Document) => Document) => void;

  // UI actions
  setActiveStudio: (id: PartStudioId | null) => void;
  setActiveSketch: (id: SketchId | null) => void;
  setSelection: (ids: Set<string>) => void;
  clearSelection: () => void;
  toggleSelected: (id: string) => void;

  // Timeline actions
  setTimelinePosition: (position: number | null) => void;

  // Tool actions
  setActiveTool: (tool: string) => void;

  // Mode actions
  setEditorMode: (mode: EditorMode) => void;
  enterPlaneSelectionMode: () => void;
  cancelPlaneSelection: () => void;
  enterSketchMode: (sketchId: SketchId) => void;
  exitSketchMode: () => void;

  // History actions
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Rebuild
  setKernel: (kernel: Kernel) => void;
  rebuild: () => Promise<void>;

  // Operations
  updateOp: (opId: OpId, updates: Partial<Op>) => void;

  // Parameters
  addParam: (name: string, value: number, unit?: string) => void;
  updateParam: (paramId: ParamId, updates: Partial<Parameter>) => void;
  removeParam: (paramId: ParamId) => void;

  // Sketch/Operation creation
  createNewSketch: (planeId?: SketchPlaneId) => SketchId | null;
  createExtrude: (sketchId: SketchId, depth?: number) => OpId | null;

  // Sketch primitive editing
  addPoint: (x: number, y: number) => PrimitiveId | null;
  addLine: (startX: number, startY: number, endX: number, endY: number) => PrimitiveId | null;
  addCircle: (centerX: number, centerY: number, radius: number) => PrimitiveId | null;
  addRectangle: (x1: number, y1: number, x2: number, y2: number) => PrimitiveId | null;
  addArc: (centerX: number, centerY: number, startX: number, startY: number, endX: number, endY: number, clockwise?: boolean) => PrimitiveId | null;
  finishSketch: () => void;
}

export type CadStore = CadState & CadActions;

// ============================================================================
// Initial State
// ============================================================================

function createInitialState(): CadState {
  // Create a document with a default 10cm cube to get users started
  const document = createDocumentWithCube("Untitled");
  const defaultStudio = getDefaultStudio(document);

  return {
    document,
    historyState: createHistory(document),
    activeStudioId: defaultStudio?.id ?? null,
    activeSketchId: null,
    selection: new Set(),
    editorMode: "object" as EditorMode,
    timelinePosition: null, // null = show all operations
    activeTool: "select",
    isRebuilding: false,
    rebuildError: null,
    kernel: null,
  };
}

// ============================================================================
// Store
// ============================================================================

export const useCadStore = create<CadStore>((set, get) => ({
  ...createInitialState(),

  // Document actions
  setDocument: (doc) => {
    set({ document: doc });
  },

  updateDocument: (updater) => {
    const { document, historyState } = get();
    const newDoc = updater(document);

    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  // UI actions
  setActiveStudio: (id) => {
    set({ activeStudioId: id, activeSketchId: null });
  },

  setActiveSketch: (id) => {
    set({ activeSketchId: id });
  },

  setSelection: (ids) => {
    set({ selection: ids });
  },

  clearSelection: () => {
    set({ selection: new Set() });
  },

  toggleSelected: (id) => {
    const { selection } = get();
    const newSelection = new Set(selection);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    set({ selection: newSelection });
  },

  // Timeline actions
  setTimelinePosition: (position) => {
    set({ timelinePosition: position });
  },

  // Tool actions
  setActiveTool: (tool) => {
    console.log("[CAD] setActiveTool:", tool);
    set({ activeTool: tool });
  },

  // Mode actions
  setEditorMode: (mode) => {
    console.log("[CAD] setEditorMode:", mode);
    set({ editorMode: mode });
  },

  enterPlaneSelectionMode: () => {
    console.log("[CAD] enterPlaneSelectionMode");
    set({
      editorMode: "select-plane",
      activeTool: "sketch",
    });
  },

  cancelPlaneSelection: () => {
    console.log("[CAD] cancelPlaneSelection");
    set({
      editorMode: "object",
      activeTool: "select",
    });
  },

  enterSketchMode: (sketchId) => {
    console.log("[CAD] enterSketchMode:", sketchId);
    set({
      editorMode: "sketch",
      activeSketchId: sketchId,
      activeTool: "line",
    });
  },

  exitSketchMode: () => {
    console.log("[CAD] exitSketchMode");
    set({
      editorMode: "object",
      activeSketchId: null,
      activeTool: "select",
    });
  },

  // History actions
  pushHistory: () => {
    const { document, historyState } = get();
    set({ historyState: pushState(historyState, document) });
  },

  undo: () => {
    const { historyState } = get();
    const newHistory = undo(historyState);
    set({
      historyState: newHistory,
      document: newHistory.present,
    });
  },

  redo: () => {
    const { historyState } = get();
    const newHistory = redo(historyState);
    set({
      historyState: newHistory,
      document: newHistory.present,
    });
  },

  canUndo: () => {
    const { historyState } = get();
    return historyState.past.length > 0;
  },

  canRedo: () => {
    const { historyState } = get();
    return historyState.future.length > 0;
  },

  // Rebuild
  setKernel: (kernel) => {
    set({ kernel });
  },

  rebuild: async () => {
    const { document, activeStudioId, kernel } = get();
    if (!kernel || !activeStudioId) return;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return;

    set({ isRebuilding: true, rebuildError: null });

    try {
      // const { partStudio } = await import("@vibecad/core");
      // const rebuiltStudio = await partStudio.rebuild(studio, document.params, kernel.occ, kernel.slvs);

      // For now, just mark as done since rebuild needs actual WASM
      // TODO: Hook up real rebuild when WASM is integrated

      set({ isRebuilding: false });
    } catch (e) {
      set({
        isRebuilding: false,
        rebuildError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  // Operations
  updateOp: (opId, updates) => {
    const { document, activeStudioId, historyState } = get();
    if (!activeStudioId) return;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return;

    const opNode = studio.opGraph.get(opId);
    if (!opNode) return;

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(opId, { ...opNode, op: { ...opNode.op, ...updates } as Op });

    const newStudio = { ...studio, opGraph: newOpGraph };
    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  // Parameters
  addParam: (name, value, unit) => {
    const { document, historyState } = get();
    const param = createParam(name, value, unit);
    const newParams = params.addParam(document.params, param);
    const newDoc = { ...document, params: newParams };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  updateParam: (paramId, updates) => {
    const { document, historyState } = get();
    const existingParam = document.params.params.get(paramId);
    if (!existingParam) return;

    const newParamsMap = new Map(document.params.params);
    newParamsMap.set(paramId, { ...existingParam, ...updates });

    const newParams: ParamEnv = {
      ...document.params,
      params: newParamsMap,
    };

    // Re-evaluate if expression changed
    const evaluatedParams = params.evaluateParams(newParams);

    const newDoc = { ...document, params: evaluatedParams };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  removeParam: (paramId) => {
    const { document, historyState } = get();
    const newParams = params.removeParam(document.params, paramId);
    const newDoc = { ...document, params: newParams };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  // Sketch/Operation creation
  createNewSketch: (planeId) => {
    const { document, activeStudioId, historyState } = get();
    if (!activeStudioId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    // Use provided plane or default to XY datum
    const targetPlaneId = planeId ?? DATUM_XY.id;

    // Create a new empty sketch
    const sketchCount = studio.sketches.size + 1;
    const sketch = createSketch(`Sketch ${sketchCount}`, targetPlaneId);

    // Create the sketch operation
    const sketchOpId = newId("Op") as OpId;
    const sketchOp: SketchOp = {
      id: sketchOpId,
      type: "sketch",
      name: sketch.name,
      suppressed: false,
      sketchId: sketch.id,
      planeRef: targetPlaneId,
    };

    // Update studio
    const newSketches = new Map(studio.sketches);
    newSketches.set(sketch.id, sketch);

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(sketchOpId, { op: sketchOp, deps: [] });

    const newOpOrder = [...studio.opOrder, sketchOpId];

    const newStudio = {
      ...studio,
      sketches: newSketches,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    };

    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };

    console.log("[CAD] createNewSketch:", sketch.id, sketch.name);

    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
      activeSketchId: sketch.id,
      editorMode: "sketch",
      activeTool: "line",
      timelinePosition: null, // Show all ops
    });

    return sketch.id;
  },

  createExtrude: (sketchId, depth = 100) => {
    const { document, activeStudioId, historyState } = get();
    if (!activeStudioId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    const sketch = studio.sketches.get(sketchId);
    if (!sketch) return null;

    // Find the sketch operation that owns this sketch
    let sketchOpId: OpId | null = null;
    for (const [opId, node] of studio.opGraph) {
      if (node.op.type === "sketch" && node.op.sketchId === sketchId) {
        sketchOpId = opId;
        break;
      }
    }

    // Create the extrude operation
    const extrudeOpId = newId("Op") as OpId;
    const extrudeOp: ExtrudeOp = {
      id: extrudeOpId,
      type: "extrude",
      name: `Extrude ${sketch.name}`,
      suppressed: false,
      sketchId: sketchId,
      profiles: [], // Empty means all closed loops
      direction: "normal",
      depth: dimLiteral(depth),
    };

    // Update studio
    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(extrudeOpId, {
      op: extrudeOp,
      deps: sketchOpId ? [sketchOpId] : [],
    });

    const newOpOrder = [...studio.opOrder, extrudeOpId];

    const newStudio = {
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    };

    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };

    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
      timelinePosition: null, // Show all ops
    });

    return extrudeOpId;
  },

  // Sketch primitive editing
  addPoint: (x, y) => {
    const { document, activeStudioId, activeSketchId, historyState } = get();
    if (!activeStudioId || !activeSketchId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return null;

    const pointId = newId("Primitive") as PrimitiveId;
    const point: PointPrimitive = {
      id: pointId,
      type: "point",
      x,
      y,
      construction: false,
    };

    const newPrimitives = new Map(sketch.primitives);
    newPrimitives.set(pointId, point);

    const newSolvedPositions = new Map(sketch.solvedPositions || []);
    newSolvedPositions.set(pointId, [x, y]);

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    const newStudio = { ...studio, sketches: newSketches };
    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });

    return pointId;
  },

  addLine: (startX, startY, endX, endY) => {
    console.log("[CAD] addLine:", { startX, startY, endX, endY });
    const { document, activeStudioId, activeSketchId, historyState } = get();
    if (!activeStudioId || !activeSketchId) {
      console.log("[CAD] addLine failed: no active studio or sketch", { activeStudioId, activeSketchId });
      return null;
    }

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) {
      console.log("[CAD] addLine failed: studio not found");
      return null;
    }

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) {
      console.log("[CAD] addLine failed: sketch not found");
      return null;
    }

    // Create start and end points
    const startPointId = newId("Primitive") as PrimitiveId;
    const endPointId = newId("Primitive") as PrimitiveId;
    const lineId = newId("Primitive") as PrimitiveId;

    const startPoint: PointPrimitive = {
      id: startPointId,
      type: "point",
      x: startX,
      y: startY,
      construction: false,
    };

    const endPoint: PointPrimitive = {
      id: endPointId,
      type: "point",
      x: endX,
      y: endY,
      construction: false,
    };

    const line: LinePrimitive = {
      id: lineId,
      type: "line",
      start: startPointId,
      end: endPointId,
      construction: false,
    };

    const newPrimitives = new Map(sketch.primitives);
    newPrimitives.set(startPointId, startPoint);
    newPrimitives.set(endPointId, endPoint);
    newPrimitives.set(lineId, line);

    const newSolvedPositions = new Map(sketch.solvedPositions || []);
    newSolvedPositions.set(startPointId, [startX, startY]);
    newSolvedPositions.set(endPointId, [endX, endY]);

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    const newStudio = { ...studio, sketches: newSketches };
    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });

    console.log("[CAD] addLine SUCCESS:", lineId, "sketch now has", newPrimitives.size, "primitives");
    return lineId;
  },

  addCircle: (centerX, centerY, radius) => {
    console.log("[CAD] addCircle:", { centerX, centerY, radius });
    const { document, activeStudioId, activeSketchId, historyState } = get();
    if (!activeStudioId || !activeSketchId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return null;

    const centerPointId = newId("Primitive") as PrimitiveId;
    const circleId = newId("Primitive") as PrimitiveId;

    const centerPoint: PointPrimitive = {
      id: centerPointId,
      type: "point",
      x: centerX,
      y: centerY,
      construction: false,
    };

    const circle: CirclePrimitive = {
      id: circleId,
      type: "circle",
      center: centerPointId,
      radius,
      construction: false,
    };

    const newPrimitives = new Map(sketch.primitives);
    newPrimitives.set(centerPointId, centerPoint);
    newPrimitives.set(circleId, circle);

    const newSolvedPositions = new Map(sketch.solvedPositions || []);
    newSolvedPositions.set(centerPointId, [centerX, centerY]);

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    const newStudio = { ...studio, sketches: newSketches };
    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });

    return circleId;
  },

  addRectangle: (x1, y1, x2, y2) => {
    const { document, activeStudioId, activeSketchId, historyState } = get();
    if (!activeStudioId || !activeSketchId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return null;

    // Create 4 corner points
    const p1Id = newId("Primitive") as PrimitiveId;
    const p2Id = newId("Primitive") as PrimitiveId;
    const p3Id = newId("Primitive") as PrimitiveId;
    const p4Id = newId("Primitive") as PrimitiveId;

    const p1: PointPrimitive = { id: p1Id, type: "point", x: x1, y: y1, construction: false };
    const p2: PointPrimitive = { id: p2Id, type: "point", x: x2, y: y1, construction: false };
    const p3: PointPrimitive = { id: p3Id, type: "point", x: x2, y: y2, construction: false };
    const p4: PointPrimitive = { id: p4Id, type: "point", x: x1, y: y2, construction: false };

    // Create 4 lines connecting the points
    const l1Id = newId("Primitive") as PrimitiveId;
    const l2Id = newId("Primitive") as PrimitiveId;
    const l3Id = newId("Primitive") as PrimitiveId;
    const l4Id = newId("Primitive") as PrimitiveId;

    const l1: LinePrimitive = { id: l1Id, type: "line", start: p1Id, end: p2Id, construction: false };
    const l2: LinePrimitive = { id: l2Id, type: "line", start: p2Id, end: p3Id, construction: false };
    const l3: LinePrimitive = { id: l3Id, type: "line", start: p3Id, end: p4Id, construction: false };
    const l4: LinePrimitive = { id: l4Id, type: "line", start: p4Id, end: p1Id, construction: false };

    const newPrimitives = new Map(sketch.primitives);
    newPrimitives.set(p1Id, p1);
    newPrimitives.set(p2Id, p2);
    newPrimitives.set(p3Id, p3);
    newPrimitives.set(p4Id, p4);
    newPrimitives.set(l1Id, l1);
    newPrimitives.set(l2Id, l2);
    newPrimitives.set(l3Id, l3);
    newPrimitives.set(l4Id, l4);

    const newSolvedPositions = new Map(sketch.solvedPositions || []);
    newSolvedPositions.set(p1Id, [x1, y1]);
    newSolvedPositions.set(p2Id, [x2, y1]);
    newSolvedPositions.set(p3Id, [x2, y2]);
    newSolvedPositions.set(p4Id, [x1, y2]);

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    const newStudio = { ...studio, sketches: newSketches };
    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });

    return l1Id; // Return first line as reference
  },

  addArc: (centerX, centerY, startX, startY, endX, endY, clockwise = false) => {
    const { document, activeStudioId, activeSketchId, historyState } = get();
    if (!activeStudioId || !activeSketchId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return null;

    const centerPointId = newId("Primitive") as PrimitiveId;
    const startPointId = newId("Primitive") as PrimitiveId;
    const endPointId = newId("Primitive") as PrimitiveId;
    const arcId = newId("Primitive") as PrimitiveId;

    const centerPoint: PointPrimitive = {
      id: centerPointId,
      type: "point",
      x: centerX,
      y: centerY,
      construction: false,
    };

    const startPoint: PointPrimitive = {
      id: startPointId,
      type: "point",
      x: startX,
      y: startY,
      construction: false,
    };

    const endPoint: PointPrimitive = {
      id: endPointId,
      type: "point",
      x: endX,
      y: endY,
      construction: false,
    };

    const arc: ArcPrimitive = {
      id: arcId,
      type: "arc",
      center: centerPointId,
      start: startPointId,
      end: endPointId,
      clockwise,
      construction: false,
    };

    const newPrimitives = new Map(sketch.primitives);
    newPrimitives.set(centerPointId, centerPoint);
    newPrimitives.set(startPointId, startPoint);
    newPrimitives.set(endPointId, endPoint);
    newPrimitives.set(arcId, arc);

    const newSolvedPositions = new Map(sketch.solvedPositions || []);
    newSolvedPositions.set(centerPointId, [centerX, centerY]);
    newSolvedPositions.set(startPointId, [startX, startY]);
    newSolvedPositions.set(endPointId, [endX, endY]);

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    const newStudio = { ...studio, sketches: newSketches };
    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });

    return arcId;
  },

  finishSketch: () => {
    const { activeSketchId } = get();
    if (activeSketchId) {
      set({ activeSketchId: null, activeTool: "select" });
    }
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectDocument = (state: CadStore) => state.document;
export const selectActiveStudio = (state: CadStore) => {
  const { document, activeStudioId } = state;
  if (!activeStudioId) return null;
  return document.partStudios.get(activeStudioId) ?? null;
};
export const selectActiveSketch = (state: CadStore) => {
  const studio = selectActiveStudio(state);
  const { activeSketchId } = state;
  if (!studio || !activeSketchId) return null;
  return studio.sketches.get(activeSketchId) ?? null;
};
export const selectParams = (state: CadStore) => state.document.params;
export const selectSelection = (state: CadStore) => state.selection;
export const selectIsRebuilding = (state: CadStore) => state.isRebuilding;
export const selectTimelinePosition = (state: CadStore) => state.timelinePosition;
