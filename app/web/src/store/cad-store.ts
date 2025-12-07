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
  RevolveOp,
  BooleanOp,
  FilletOp,
  PrimitiveId,
  PointPrimitive,
  LinePrimitive,
  CirclePrimitive,
  ArcPrimitive,
  Sketch,
} from "@vibecad/core";
import type { ExportableMesh } from "../utils/stl-export";
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

export type EditorMode = "object" | "select-plane" | "sketch" | "select-face";

// Face selection target - what operation is requesting the face
export type FaceSelectionTarget =
  | { type: "sketch-plane" }  // Selecting a plane for a new sketch
  | { type: "extrude-profile"; opId?: string }  // Selecting a sketch profile for extrude
  | { type: "extrude-face"; opId?: string };  // Selecting a face for face extrude

// Selected face reference
export type SelectedFace =
  | { type: "datum-plane"; planeId: string }
  | { type: "sketch-profile"; sketchId: string }
  | { type: "body-face"; bodyId: string; faceIndex: number };

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

  // Sketch interaction state (set by Viewport via raycasting)
  sketchMousePos: { x: number; y: number } | null;

  // Sketch drawing state
  sketchDrawingState:
    | { type: "idle" }
    | { type: "line"; start: { x: number; y: number } }
    | { type: "rect"; start: { x: number; y: number } }
    | { type: "circle"; center: { x: number; y: number } }
    | { type: "arc"; step: "center" | "start" | "end"; center?: { x: number; y: number }; start?: { x: number; y: number } };

  // Grid snapping for sketch mode
  gridSnappingEnabled: boolean;

  // Face selection state
  faceSelectionTarget: FaceSelectionTarget | null;
  selectedFace: SelectedFace | null;

  // Pending extrude (when user clicks extrude before selecting a profile)
  pendingExtrude: {
    sketchId: string | null;
    bodyFace: { opId: string; faceIndex: number } | null;
    depth: number;
    direction: "normal" | "reverse" | "symmetric";
  } | null;

  // Pending revolve
  pendingRevolve: {
    sketchId: string | null;
    angle: number; // in degrees
    axis: "x" | "y" | "sketch-x" | "sketch-y";
  } | null;

  // Pending fillet
  pendingFillet: {
    targetOpId: string | null;
    edgeIndices: number[];
    radius: number;
  } | null;

  // Pending boolean
  pendingBoolean: {
    operation: "union" | "subtract" | "intersect";
    targetOpId: string | null;
    toolOpId: string | null;
  } | null;

  // Hovered face for face selection mode
  hoveredFace: {
    type: "sketch";
    sketchId: string;
  } | {
    type: "body-face";
    opId: string;
    faceIndex: number;
  } | null;

  // Export mesh data (populated by Viewport for export)
  exportMeshes: ExportableMesh[];
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
  deleteOp: (opId: OpId) => void;

  // Parameters
  addParam: (name: string, value: number, unit?: string) => void;
  updateParam: (paramId: ParamId, updates: Partial<Parameter>) => void;
  removeParam: (paramId: ParamId) => void;

  // Sketch/Operation creation
  createNewSketch: (planeId?: SketchPlaneId) => SketchId | null;
  createExtrude: (sketchId: SketchId, depth?: number, direction?: "normal" | "reverse" | "symmetric") => OpId | null;
  createExtrudeFromFace: (opId: string, faceIndex: number, depth?: number, direction?: "normal" | "reverse" | "symmetric") => OpId | null;

  // Sketch primitive editing
  addPoint: (x: number, y: number) => PrimitiveId | null;
  addLine: (startX: number, startY: number, endX: number, endY: number) => PrimitiveId | null;
  addCircle: (centerX: number, centerY: number, radius: number) => PrimitiveId | null;
  addRectangle: (x1: number, y1: number, x2: number, y2: number) => PrimitiveId | null;
  addArc: (centerX: number, centerY: number, startX: number, startY: number, endX: number, endY: number, clockwise?: boolean) => PrimitiveId | null;
  finishSketch: () => void;

  // Sketch mouse position (set by Viewport via raycasting onto sketch plane)
  setSketchMousePos: (pos: { x: number; y: number } | null) => void;

  // Sketch drawing actions
  handleSketchClick: () => void;
  cancelSketchDrawing: () => void;

  // Grid snapping toggle
  toggleGridSnapping: () => void;

  // Face selection actions
  enterFaceSelectionMode: (target: FaceSelectionTarget) => void;
  exitFaceSelectionMode: () => void;
  selectFace: (face: SelectedFace) => void;

  // Extrude workflow
  startExtrude: () => void;
  setPendingExtrudeSketch: (sketchId: string | null) => void;
  setPendingExtrudeBodyFace: (bodyFace: { opId: string; faceIndex: number } | null) => void;
  setPendingExtrudeDepth: (depth: number) => void;
  setPendingExtrudeDirection: (direction: "normal" | "reverse" | "symmetric") => void;
  confirmExtrude: () => void;
  cancelExtrude: () => void;

  // Revolve workflow
  startRevolve: () => void;
  setPendingRevolveSketch: (sketchId: string | null) => void;
  setPendingRevolveAngle: (angle: number) => void;
  setPendingRevolveAxis: (axis: "x" | "y" | "sketch-x" | "sketch-y") => void;
  confirmRevolve: () => void;
  cancelRevolve: () => void;
  createRevolve: (sketchId: SketchId, angle?: number, axis?: "x" | "y" | "sketch-x" | "sketch-y") => OpId | null;

  // Fillet workflow
  startFillet: () => void;
  setPendingFilletTarget: (opId: string | null) => void;
  setPendingFilletRadius: (radius: number) => void;
  toggleFilletEdge: (edgeIndex: number) => void;
  confirmFillet: () => void;
  cancelFillet: () => void;
  createFillet: (targetOpId: OpId, edgeIndices: number[], radius: number) => OpId | null;

  // Boolean workflow
  startBoolean: (operation: "union" | "subtract" | "intersect") => void;
  setPendingBooleanTarget: (opId: string | null) => void;
  setPendingBooleanTool: (opId: string | null) => void;
  confirmBoolean: () => void;
  cancelBoolean: () => void;
  createBoolean: (operation: "union" | "subtract" | "intersect", targetOpId: OpId, toolOpId: OpId) => OpId | null;

  // Hover state for face selection
  setHoveredFace: (face: CadState["hoveredFace"]) => void;

  // Export actions
  setExportMeshes: (meshes: ExportableMesh[]) => void;
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
    sketchMousePos: null,
    sketchDrawingState: { type: "idle" },
    gridSnappingEnabled: true,
    faceSelectionTarget: null,
    selectedFace: null,
    pendingExtrude: null,
    pendingRevolve: null,
    pendingFillet: null,
    pendingBoolean: null,
    hoveredFace: null,
    exportMeshes: [],
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

  deleteOp: (opId) => {
    const { document, activeStudioId, historyState, selection } = get();
    if (!activeStudioId) return;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return;

    const opNode = studio.opGraph.get(opId);
    if (!opNode) return;

    // Remove from opGraph
    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.delete(opId);

    // Remove from opOrder
    const newOpOrder = studio.opOrder.filter((id) => id !== opId);

    // If it's a sketch operation, also remove the sketch
    let newSketches = studio.sketches;
    if (opNode.op.type === "sketch") {
      const sketchOp = opNode.op as SketchOp;
      newSketches = new Map(studio.sketches);
      newSketches.delete(sketchOp.sketchId);
    }

    const newStudio = {
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
      sketches: newSketches,
    };
    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };

    // Remove from selection if selected
    const newSelection = new Set(selection);
    newSelection.delete(opId);

    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
      selection: newSelection,
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

  createExtrude: (sketchId, depth = 100, direction = "normal") => {
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

    // Create the extrude operation with unified profile abstraction
    const extrudeOpId = newId("Op") as OpId;
    const extrudeOp: ExtrudeOp = {
      id: extrudeOpId,
      type: "extrude",
      name: `Extrude ${sketch.name}`,
      suppressed: false,
      profile: {
        type: "sketch",
        sketchId: sketchId,
      },
      direction: direction,
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

  createExtrudeFromFace: (opId, faceIndex, depth = 100, direction = "normal") => {
    const { document, activeStudioId, historyState } = get();
    if (!activeStudioId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    // Verify the source operation exists
    const sourceOp = studio.opGraph.get(opId as OpId);
    if (!sourceOp) return null;

    // Create extrude operation with unified profile abstraction (face type)
    const extrudeOpId = newId("Op") as OpId;
    const extrudeOp: ExtrudeOp = {
      id: extrudeOpId,
      type: "extrude",
      name: `Extrude from ${sourceOp.op.name}`,
      suppressed: false,
      profile: {
        type: "face",
        faceRef: {
          opId: opId as OpId,
          subType: "face",
          index: faceIndex,
        },
      },
      direction: direction,
      depth: dimLiteral(depth),
    };

    // Update studio
    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(extrudeOpId, {
      op: extrudeOp,
      deps: [opId as OpId],
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
      timelinePosition: null,
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

  setSketchMousePos: (pos) => {
    set({ sketchMousePos: pos });
  },

  handleSketchClick: () => {
    const { activeSketchId, activeTool, sketchMousePos, sketchDrawingState } = get();
    if (!activeSketchId || !sketchMousePos) return;

    const pos = sketchMousePos;
    const addLine = get().addLine;
    const addRectangle = get().addRectangle;
    const addCircle = get().addCircle;
    const addArc = get().addArc;

    switch (activeTool) {
      case "line":
        if (sketchDrawingState.type === "line") {
          // Complete the line
          addLine(sketchDrawingState.start.x, sketchDrawingState.start.y, pos.x, pos.y);
          set({ sketchDrawingState: { type: "idle" } });
        } else {
          // Start a new line
          set({ sketchDrawingState: { type: "line", start: pos } });
        }
        break;

      case "rect":
        if (sketchDrawingState.type === "rect") {
          // Complete the rectangle
          addRectangle(sketchDrawingState.start.x, sketchDrawingState.start.y, pos.x, pos.y);
          set({ sketchDrawingState: { type: "idle" } });
        } else {
          // Start a new rectangle
          set({ sketchDrawingState: { type: "rect", start: pos } });
        }
        break;

      case "circle":
        if (sketchDrawingState.type === "circle") {
          // Complete the circle
          const dx = pos.x - sketchDrawingState.center.x;
          const dy = pos.y - sketchDrawingState.center.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          if (radius > 0) {
            addCircle(sketchDrawingState.center.x, sketchDrawingState.center.y, radius);
          }
          set({ sketchDrawingState: { type: "idle" } });
        } else {
          // Start a new circle
          set({ sketchDrawingState: { type: "circle", center: pos } });
        }
        break;

      case "arc":
        if (sketchDrawingState.type === "arc") {
          if (sketchDrawingState.step === "start" && sketchDrawingState.center) {
            // Set start point
            set({ sketchDrawingState: { ...sketchDrawingState, step: "end", start: pos } });
          } else if (sketchDrawingState.step === "end" && sketchDrawingState.center && sketchDrawingState.start) {
            // Complete the arc
            addArc(
              sketchDrawingState.center.x,
              sketchDrawingState.center.y,
              sketchDrawingState.start.x,
              sketchDrawingState.start.y,
              pos.x,
              pos.y,
              false
            );
            set({ sketchDrawingState: { type: "idle" } });
          }
        } else {
          // Start a new arc - first click is center
          set({ sketchDrawingState: { type: "arc", step: "start", center: pos } });
        }
        break;
    }
  },

  cancelSketchDrawing: () => {
    set({ sketchDrawingState: { type: "idle" } });
  },

  toggleGridSnapping: () => {
    set((state) => ({ gridSnappingEnabled: !state.gridSnappingEnabled }));
  },

  // Face selection actions
  enterFaceSelectionMode: (target) => {
    set({
      editorMode: "select-face",
      faceSelectionTarget: target,
      selectedFace: null,
    });
  },

  exitFaceSelectionMode: () => {
    set({
      editorMode: "object",
      faceSelectionTarget: null,
      selectedFace: null,
    });
  },

  selectFace: (face) => {
    const { faceSelectionTarget, pendingExtrude } = get();

    // If selecting for sketch plane
    if (faceSelectionTarget?.type === "sketch-plane") {
      if (face.type === "datum-plane") {
        // Create sketch on this plane
        const createNewSketch = get().createNewSketch;
        createNewSketch(face.planeId as any);
      }
      set({
        editorMode: "object",
        faceSelectionTarget: null,
        selectedFace: null,
      });
      return;
    }

    // If selecting for extrude profile
    if (faceSelectionTarget?.type === "extrude-profile") {
      if (face.type === "sketch-profile") {
        set({
          selectedFace: face,
          pendingExtrude: pendingExtrude
            ? { ...pendingExtrude, sketchId: face.sketchId, bodyFace: null }
            : { sketchId: face.sketchId, bodyFace: null, depth: 10, direction: "normal" },
          editorMode: "object",
          faceSelectionTarget: null,
        });
      }
      return;
    }

    // Default: just store the selected face
    set({ selectedFace: face });
  },

  // Extrude workflow
  startExtrude: () => {
    const { activeSketchId } = get();
    // If a sketch is already selected, use it
    if (activeSketchId) {
      set({
        pendingExtrude: { sketchId: activeSketchId, bodyFace: null, depth: 10, direction: "normal" },
        activeTool: "extrude",
      });
    } else {
      // Enter face selection mode to pick a sketch profile or body face
      set({
        pendingExtrude: { sketchId: null, bodyFace: null, depth: 10, direction: "normal" },
        activeTool: "extrude",
        editorMode: "select-face",
        faceSelectionTarget: { type: "extrude-profile" },
      });
    }
  },

  setPendingExtrudeSketch: (sketchId) => {
    const { pendingExtrude } = get();
    if (pendingExtrude) {
      // Clear body face when setting sketch
      set({ pendingExtrude: { ...pendingExtrude, sketchId, bodyFace: null } });
    }
  },

  setPendingExtrudeBodyFace: (bodyFace) => {
    const { pendingExtrude } = get();
    if (pendingExtrude) {
      // Clear sketch when setting body face
      set({
        pendingExtrude: { ...pendingExtrude, bodyFace, sketchId: null },
        editorMode: "object",
        faceSelectionTarget: null,
      });
    }
  },

  setPendingExtrudeDepth: (depth) => {
    const { pendingExtrude } = get();
    if (pendingExtrude) {
      set({ pendingExtrude: { ...pendingExtrude, depth } });
    }
  },

  setPendingExtrudeDirection: (direction) => {
    const { pendingExtrude } = get();
    if (pendingExtrude) {
      set({ pendingExtrude: { ...pendingExtrude, direction } });
    }
  },

  confirmExtrude: () => {
    const { pendingExtrude, createExtrude, createExtrudeFromFace } = get();
    if (pendingExtrude?.sketchId) {
      createExtrude(pendingExtrude.sketchId as any, pendingExtrude.depth, pendingExtrude.direction);
    } else if (pendingExtrude?.bodyFace) {
      createExtrudeFromFace(
        pendingExtrude.bodyFace.opId,
        pendingExtrude.bodyFace.faceIndex,
        pendingExtrude.depth,
        pendingExtrude.direction
      );
    }
    set({
      pendingExtrude: null,
      activeTool: "select",
      selectedFace: null,
      hoveredFace: null,
    });
  },

  cancelExtrude: () => {
    set({
      pendingExtrude: null,
      activeTool: "select",
      editorMode: "object",
      faceSelectionTarget: null,
      selectedFace: null,
      hoveredFace: null,
    });
  },

  // Revolve workflow
  startRevolve: () => {
    const { activeSketchId } = get();
    if (activeSketchId) {
      set({
        pendingRevolve: { sketchId: activeSketchId, angle: 360, axis: "sketch-x" },
        activeTool: "revolve",
      });
    } else {
      set({
        pendingRevolve: { sketchId: null, angle: 360, axis: "sketch-x" },
        activeTool: "revolve",
        editorMode: "select-face",
        faceSelectionTarget: { type: "extrude-profile" },
      });
    }
  },

  setPendingRevolveSketch: (sketchId) => {
    const { pendingRevolve } = get();
    if (pendingRevolve) {
      set({ pendingRevolve: { ...pendingRevolve, sketchId } });
    }
  },

  setPendingRevolveAngle: (angle) => {
    const { pendingRevolve } = get();
    if (pendingRevolve) {
      set({ pendingRevolve: { ...pendingRevolve, angle } });
    }
  },

  setPendingRevolveAxis: (axis) => {
    const { pendingRevolve } = get();
    if (pendingRevolve) {
      set({ pendingRevolve: { ...pendingRevolve, axis } });
    }
  },

  confirmRevolve: () => {
    const { pendingRevolve, createRevolve } = get();
    if (pendingRevolve?.sketchId) {
      createRevolve(pendingRevolve.sketchId as any, pendingRevolve.angle, pendingRevolve.axis);
    }
    set({
      pendingRevolve: null,
      activeTool: "select",
      selectedFace: null,
      hoveredFace: null,
    });
  },

  cancelRevolve: () => {
    set({
      pendingRevolve: null,
      activeTool: "select",
      editorMode: "object",
      faceSelectionTarget: null,
      selectedFace: null,
      hoveredFace: null,
    });
  },

  createRevolve: (sketchId, angle = 360, axis = "sketch-x") => {
    const { document, activeStudioId, historyState } = get();
    if (!activeStudioId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    const sketch = studio.sketches.get(sketchId);
    if (!sketch) return null;

    // Find the sketch operation
    let sketchOpId: OpId | null = null;
    for (const [opId, node] of studio.opGraph) {
      if (node.op.type === "sketch" && node.op.sketchId === sketchId) {
        sketchOpId = opId;
        break;
      }
    }

    // Get the plane for axis calculation
    const plane = studio.planes.get(sketch.planeId);
    if (!plane) return null;

    // Calculate axis based on option
    let axisOrigin: [number, number, number] = [0, 0, 0];
    let axisDir: [number, number, number];
    switch (axis) {
      case "x":
        axisDir = [1, 0, 0];
        break;
      case "y":
        axisDir = [0, 1, 0];
        break;
      case "sketch-x":
        axisDir = plane.axisX as [number, number, number];
        axisOrigin = plane.origin as [number, number, number];
        break;
      case "sketch-y":
        axisDir = plane.axisY as [number, number, number];
        axisOrigin = plane.origin as [number, number, number];
        break;
    }

    const revolveOpId = newId("Op") as OpId;
    const revolveOp: RevolveOp = {
      id: revolveOpId,
      type: "revolve",
      name: `Revolve ${sketch.name}`,
      suppressed: false,
      profile: {
        type: "sketch",
        sketchId: sketchId,
      },
      axis: { origin: axisOrigin, direction: axisDir },
      angle: dimLiteral(angle * Math.PI / 180), // Convert to radians
    };

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(revolveOpId, {
      op: revolveOp,
      deps: sketchOpId ? [sketchOpId] : [],
    });

    const newOpOrder = [...studio.opOrder, revolveOpId];

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
      timelinePosition: null,
    });

    return revolveOpId;
  },

  // Fillet workflow
  startFillet: () => {
    set({
      pendingFillet: { targetOpId: null, edgeIndices: [], radius: 5 },
      activeTool: "fillet",
    });
  },

  setPendingFilletTarget: (opId) => {
    const { pendingFillet } = get();
    if (pendingFillet) {
      set({ pendingFillet: { ...pendingFillet, targetOpId: opId, edgeIndices: [] } });
    }
  },

  setPendingFilletRadius: (radius) => {
    const { pendingFillet } = get();
    if (pendingFillet) {
      set({ pendingFillet: { ...pendingFillet, radius } });
    }
  },

  toggleFilletEdge: (edgeIndex) => {
    const { pendingFillet } = get();
    if (pendingFillet) {
      const edges = pendingFillet.edgeIndices.includes(edgeIndex)
        ? pendingFillet.edgeIndices.filter((e) => e !== edgeIndex)
        : [...pendingFillet.edgeIndices, edgeIndex];
      set({ pendingFillet: { ...pendingFillet, edgeIndices: edges } });
    }
  },

  confirmFillet: () => {
    const { pendingFillet, createFillet } = get();
    if (pendingFillet?.targetOpId && pendingFillet.edgeIndices.length > 0) {
      createFillet(pendingFillet.targetOpId as OpId, pendingFillet.edgeIndices, pendingFillet.radius);
    }
    set({
      pendingFillet: null,
      activeTool: "select",
    });
  },

  cancelFillet: () => {
    set({
      pendingFillet: null,
      activeTool: "select",
    });
  },

  createFillet: (targetOpId, edgeIndices, radius) => {
    const { document, activeStudioId, historyState } = get();
    if (!activeStudioId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    const targetOp = studio.opGraph.get(targetOpId);
    if (!targetOp) return null;

    const filletOpId = newId("Op") as OpId;
    const filletOp: FilletOp = {
      id: filletOpId,
      type: "fillet",
      name: `Fillet on ${targetOp.op.name}`,
      suppressed: false,
      targetOp: targetOpId,
      edges: edgeIndices.map((index) => ({
        opId: targetOpId,
        subType: "edge" as const,
        index,
      })),
      radius: dimLiteral(radius),
    };

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(filletOpId, {
      op: filletOp,
      deps: [targetOpId],
    });

    const newOpOrder = [...studio.opOrder, filletOpId];

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
      timelinePosition: null,
    });

    return filletOpId;
  },

  // Boolean workflow
  startBoolean: (operation) => {
    set({
      pendingBoolean: { operation, targetOpId: null, toolOpId: null },
      activeTool: operation,
    });
  },

  setPendingBooleanTarget: (opId) => {
    const { pendingBoolean } = get();
    if (pendingBoolean) {
      set({ pendingBoolean: { ...pendingBoolean, targetOpId: opId } });
    }
  },

  setPendingBooleanTool: (opId) => {
    const { pendingBoolean } = get();
    if (pendingBoolean) {
      set({ pendingBoolean: { ...pendingBoolean, toolOpId: opId } });
    }
  },

  confirmBoolean: () => {
    const { pendingBoolean, createBoolean } = get();
    if (pendingBoolean?.targetOpId && pendingBoolean?.toolOpId) {
      createBoolean(
        pendingBoolean.operation,
        pendingBoolean.targetOpId as OpId,
        pendingBoolean.toolOpId as OpId
      );
    }
    set({
      pendingBoolean: null,
      activeTool: "select",
    });
  },

  cancelBoolean: () => {
    set({
      pendingBoolean: null,
      activeTool: "select",
    });
  },

  createBoolean: (operation, targetOpId, toolOpId) => {
    const { document, activeStudioId, historyState } = get();
    if (!activeStudioId) return null;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;

    const targetOp = studio.opGraph.get(targetOpId);
    const toolOp = studio.opGraph.get(toolOpId);
    if (!targetOp || !toolOp) return null;

    const booleanOpId = newId("Op") as OpId;
    const booleanOp: BooleanOp = {
      id: booleanOpId,
      type: "boolean",
      name: `${operation.charAt(0).toUpperCase() + operation.slice(1)}: ${targetOp.op.name} & ${toolOp.op.name}`,
      suppressed: false,
      operation: operation,
      targetOp: targetOpId,
      toolOp: toolOpId,
    };

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(booleanOpId, {
      op: booleanOp,
      deps: [targetOpId, toolOpId],
    });

    const newOpOrder = [...studio.opOrder, booleanOpId];

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
      timelinePosition: null,
    });

    return booleanOpId;
  },

  setHoveredFace: (face) => {
    set({ hoveredFace: face });
  },

  setExportMeshes: (meshes) => {
    set({ exportMeshes: meshes });
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
export const selectExportMeshes = (state: CadStore) => state.exportMeshes;
