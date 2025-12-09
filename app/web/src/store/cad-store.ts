/**
 * CAD Store - global state management using Zustand.
 *
 * Refactored to work with a single PartStudio per file (1 file = 1 tab = 1 PartStudio).
 * No more Document wrapper with multiple part studios.
 */

import { create } from "zustand";
import type {
  PartStudio,
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
  BoxOp,
  CylinderOp,
  SphereOp,
  ConeOp,
  TransformOp,
  TopoRef,
  Vec3,
  PrimitiveId,
  PointPrimitive,
  LinePrimitive,
  CirclePrimitive,
  ArcPrimitive,
  Sketch,
  ConstraintId,
  ConstraintType,
  SolveStatus,
} from "@vibecad/core";
import type { ExportableMesh } from "../utils/stl-export";
import type { ShapeHandle } from "@vibecad/kernel";
import {
  createPartStudioWithCube,
  createParam,
  createSketch,
  newId,
  dimLiteral,
  DATUM_XY,
  touchPartStudio,
  getReferencedPoints,
  createPlaneFromNormal,
  sketch as sketchOps,
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
  | { type: "edit-sketch-plane"; opId: string; sketchId: string }  // Editing an existing sketch's plane
  | { type: "extrude-profile"; opId?: string }  // Selecting a sketch profile for extrude
  | { type: "extrude-face"; opId?: string };  // Selecting a face for face extrude

// Selected face reference
export type SelectedFace =
  | { type: "datum-plane"; planeId: string }
  | { type: "sketch-profile"; sketchId: string; loopIndex?: number }
  | { type: "body-face"; bodyId: string; faceIndex: number };

// Sketch entity selection - represents a selected sketch primitive
export type SketchEntitySelection = {
  primitiveId: PrimitiveId;
  // The original entity type that was clicked (allows materialization to lower order)
  originalType: "point" | "line" | "circle" | "arc" | "rect";
};

// Transform gizmo interaction state
export type SketchGizmoState = {
  mode: "idle" | "translate-x" | "translate-y" | "translate-xy" | "rotate";
  // Initial mouse position when drag started (in sketch coordinates)
  dragStart: { x: number; y: number } | null;
  // Selection centroid at drag start
  centroidStart: { x: number; y: number } | null;
  // Initial angle for rotation
  rotationStart: number | null;
  // Original point positions at drag start (for computing delta from original)
  originalPositions: Map<PrimitiveId, { x: number; y: number }> | null;
};

// Sketch clipboard - stores copied primitives for paste
export type SketchClipboard = {
  // Deep copy of primitives (with original IDs for reference mapping)
  primitives: Map<PrimitiveId, PointPrimitive | LinePrimitive | CirclePrimitive | ArcPrimitive>;
  // Centroid of copied entities (for relative positioning on paste)
  centroid: { x: number; y: number };
} | null;

interface CadState {
  // Main state - single PartStudio (the open file)
  studio: PartStudio;
  historyState: HistoryState<PartStudio>;

  // UI state
  activeSketchId: SketchId | null;
  objectSelection: Set<string>;  // 3D solid/body selection
  opSelection: Set<string>;      // Operation selection in timeline

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

  // Sketch entity selection (for selecting points, lines, shapes in sketch mode)
  sketchSelection: Set<PrimitiveId>;
  // Hovered sketch entity (for hover highlighting)
  hoveredSketchEntity: PrimitiveId | null;
  // Transform gizmo state
  sketchGizmoState: SketchGizmoState;
  // Sketch clipboard for copy/paste
  sketchClipboard: SketchClipboard;

  // Face selection state
  faceSelectionTarget: FaceSelectionTarget | null;
  selectedFace: SelectedFace | null;

  // Pending extrude (when user clicks extrude before selecting a profile)
  pendingExtrude: {
    sketchId: string | null;
    loopIndex?: number;  // Optional loop index within the sketch (undefined = all loops)
    bodyFace: { opId: string; faceIndex: number } | null;
    depth: number;
    direction: "normal" | "reverse" | "symmetric";
  } | null;

  // Pending revolve
  pendingRevolve: {
    sketchId: string | null;
    loopIndex?: number;  // Optional loop index within the sketch (undefined = all loops)
    bodyFace: { opId: string; faceIndex: number } | null;
    angle: number; // in degrees
    axis: "x" | "y" | "sketch-x" | "sketch-y" | "custom";
    customAxis?: { origin: [number, number, number]; direction: [number, number, number] };
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

  // Hovered face for face selection mode (includes datum planes for unified selection)
  hoveredFace: {
    type: "sketch";
    sketchId: string;
    loopIndex?: number;
  } | {
    type: "body-face";
    opId: string;
    faceIndex: number;
  } | {
    type: "datum-plane";
    planeId: string;
  } | null;

  // Pending primitive solid creation
  pendingPrimitive: {
    type: "box";
    center: Vec3;
    dimensions: Vec3;
  } | {
    type: "cylinder";
    center: Vec3;
    axis: Vec3;
    radius: number;
    height: number;
  } | {
    type: "sphere";
    center: Vec3;
    radius: number;
  } | {
    type: "cone";
    center: Vec3;
    axis: Vec3;
    radius1: number;
    radius2: number;
    height: number;
  } | null;

  // Pending transform operation
  pendingTransform: {
    targetOpId: string | null;
    transformType: "translate" | "rotate" | "scale";
    translation: Vec3;
    rotationOrigin: Vec3;
    rotationAxis: Vec3;
    rotationAngle: number;  // in degrees
    scaleFactor: number;
    scaleCenter: Vec3;
  } | null;

  // Pending constraint (when user is adding a constraint in sketch mode)
  pendingConstraint: {
    type: ConstraintType;
    entities: PrimitiveId[];
    dimension?: number;  // For dimensional constraints
  } | null;

  // Current sketch solve status (for UI display)
  currentSketchSolveStatus: SolveStatus | null;
  currentSketchDof: number | null;

  // Export mesh data (populated by Viewport for export)
  exportMeshes: ExportableMesh[];

  // Export shape handles (for STEP export - populated by Viewport)
  exportShapeHandles: ShapeHandle[];
}

interface CadActions {
  // Studio actions (replaces document actions)
  setStudio: (studio: PartStudio) => void;
  updateStudio: (updater: (studio: PartStudio) => PartStudio) => void;

  // Legacy compatibility - maps to studio
  setDocument: (studio: PartStudio) => void;
  loadDocument: (studio: PartStudio) => void;

  // UI actions
  setActiveSketch: (id: SketchId | null) => void;
  setObjectSelection: (ids: Set<string>) => void;
  clearObjectSelection: () => void;
  toggleObjectSelected: (id: string) => void;
  setOpSelection: (ids: Set<string>) => void;
  clearOpSelection: () => void;
  toggleOpSelected: (id: string) => void;

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
  createNewSketchFromFace: (faceRef: { opId: string; faceIndex: number }, center: Vec3, normal: Vec3) => SketchId | null;
  createExtrude: (sketchId: SketchId, depth?: number, direction?: "normal" | "reverse" | "symmetric", loopIndex?: number) => OpId | null;
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

  // Sketch selection actions
  setSketchSelection: (ids: Set<PrimitiveId>) => void;
  clearSketchSelection: () => void;
  toggleSketchEntitySelected: (id: PrimitiveId) => void;
  setHoveredSketchEntity: (id: PrimitiveId | null) => void;
  // Get all point IDs that are part of the selection (materialized)
  getMaterializedSelectionPoints: () => PrimitiveId[];
  // Update point positions (for transform gizmo)
  updateSketchPointPositions: (updates: Map<PrimitiveId, { x: number; y: number }>) => void;
  // Gizmo interaction
  startSketchGizmoDrag: (mode: SketchGizmoState["mode"], mousePos: { x: number; y: number }) => void;
  updateSketchGizmoDrag: (mousePos: { x: number; y: number }) => void;
  endSketchGizmoDrag: () => void;
  // Clipboard operations
  deleteSketchSelection: () => void;
  copySketchSelection: () => void;
  cutSketchSelection: () => void;
  pasteSketchClipboard: () => void;
  duplicateSketchSelection: () => void;
  selectAllSketchEntities: () => void;

  // Face selection actions
  enterFaceSelectionMode: (target: FaceSelectionTarget) => void;
  exitFaceSelectionMode: () => void;
  selectFace: (face: SelectedFace) => void;

  // Extrude workflow
  startExtrude: () => void;
  setPendingExtrudeSketch: (sketchId: string | null, loopIndex?: number) => void;
  setPendingExtrudeBodyFace: (bodyFace: { opId: string; faceIndex: number } | null) => void;
  setPendingExtrudeDepth: (depth: number) => void;
  setPendingExtrudeDirection: (direction: "normal" | "reverse" | "symmetric") => void;
  confirmExtrude: () => void;
  cancelExtrude: () => void;

  // Revolve workflow
  startRevolve: () => void;
  setPendingRevolveSketch: (sketchId: string | null, loopIndex?: number) => void;
  setPendingRevolveBodyFace: (bodyFace: { opId: string; faceIndex: number } | null) => void;
  setPendingRevolveAngle: (angle: number) => void;
  setPendingRevolveAxis: (axis: "x" | "y" | "sketch-x" | "sketch-y" | "custom") => void;
  setPendingRevolveCustomAxis: (origin: [number, number, number], direction: [number, number, number]) => void;
  confirmRevolve: () => void;
  cancelRevolve: () => void;
  createRevolve: (sketchId: SketchId, angle?: number, axis?: "x" | "y" | "sketch-x" | "sketch-y" | "custom", customAxis?: { origin: [number, number, number]; direction: [number, number, number] }) => OpId | null;
  createRevolveFromFace: (opId: string, faceIndex: number, angle?: number, axis?: { origin: [number, number, number]; direction: [number, number, number] }) => OpId | null;

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

  // Primitive solid workflow
  startPrimitive: (type: "box" | "cylinder" | "sphere" | "cone") => void;
  updatePendingPrimitive: (updates: Partial<NonNullable<CadState["pendingPrimitive"]>>) => void;
  confirmPrimitive: () => void;
  cancelPrimitive: () => void;
  createBox: (center: Vec3, dimensions: Vec3) => OpId | null;
  createCylinder: (center: Vec3, axis: Vec3, radius: number, height: number) => OpId | null;
  createSphere: (center: Vec3, radius: number) => OpId | null;
  createCone: (center: Vec3, axis: Vec3, radius1: number, radius2: number, height: number) => OpId | null;

  // Transform workflow
  startTransform: (type: "translate" | "rotate" | "scale") => void;
  setPendingTransformTarget: (opId: string | null) => void;
  updatePendingTransform: (updates: Partial<NonNullable<CadState["pendingTransform"]>>) => void;
  confirmTransform: () => void;
  cancelTransform: () => void;
  createTransform: (
    targetOpId: OpId,
    transformType: "translate" | "rotate" | "scale",
    params: {
      translation?: Vec3;
      rotationOrigin?: Vec3;
      rotationAxis?: Vec3;
      rotationAngle?: number;
      scaleFactor?: number;
      scaleCenter?: Vec3;
    }
  ) => OpId | null;

  // Export actions
  setExportMeshes: (meshes: ExportableMesh[]) => void;
  setExportShapeHandles: (handles: ShapeHandle[]) => void;
  resetDocument: () => void;

  // Constraint actions
  startConstraint: (type: ConstraintType) => void;
  addConstraintEntity: (primitiveId: PrimitiveId) => void;
  setConstraintDimension: (value: number) => void;
  confirmConstraint: () => void;
  cancelConstraint: () => void;
  deleteConstraint: (constraintId: ConstraintId) => void;
  solveActiveSketch: () => void;
}

export type CadStore = CadState & CadActions;

// ============================================================================
// Initial State
// ============================================================================

function createInitialState(): CadState {
  // Create a PartStudio with a default 10cm cube to get users started
  const studio = createPartStudioWithCube("Untitled");

  return {
    studio,
    historyState: createHistory(studio),
    activeSketchId: null,
    objectSelection: new Set(),
    opSelection: new Set(),
    editorMode: "object" as EditorMode,
    timelinePosition: null, // null = show all operations
    activeTool: "select",
    isRebuilding: false,
    rebuildError: null,
    kernel: null,
    sketchMousePos: null,
    sketchDrawingState: { type: "idle" },
    gridSnappingEnabled: false,
    sketchSelection: new Set<PrimitiveId>(),
    hoveredSketchEntity: null,
    sketchGizmoState: {
      mode: "idle",
      dragStart: null,
      centroidStart: null,
      rotationStart: null,
      originalPositions: null,
    },
    sketchClipboard: null,
    faceSelectionTarget: null,
    selectedFace: null,
    pendingExtrude: null,
    pendingRevolve: null,
    pendingFillet: null,
    pendingBoolean: null,
    hoveredFace: null,
    pendingPrimitive: null,
    pendingTransform: null,
    pendingConstraint: null,
    currentSketchSolveStatus: null,
    currentSketchDof: null,
    exportMeshes: [],
    exportShapeHandles: [],
  };
}

// ============================================================================
// Store
// ============================================================================

export const useCadStore = create<CadStore>((set, get) => ({
  ...createInitialState(),

  // Studio actions
  setStudio: (studio) => {
    set({
      studio,
      historyState: createHistory(studio),
      activeSketchId: null,
      objectSelection: new Set(),
      opSelection: new Set(),
    });
  },

  updateStudio: (updater) => {
    const { studio, historyState } = get();
    const newStudio = touchPartStudio(updater(studio));

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });
  },

  // Legacy compatibility
  setDocument: (studio) => {
    get().setStudio(studio);
  },

  loadDocument: (studio) => {
    get().setStudio(studio);
  },

  // UI actions
  setActiveSketch: (id) => {
    set({ activeSketchId: id });
  },

  setObjectSelection: (ids) => {
    set({ objectSelection: ids });
  },

  clearObjectSelection: () => {
    set({ objectSelection: new Set() });
  },

  toggleObjectSelected: (id) => {
    const { objectSelection } = get();
    const newSelection = new Set(objectSelection);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    set({ objectSelection: newSelection });
  },

  setOpSelection: (ids) => {
    set({ opSelection: ids });
  },

  clearOpSelection: () => {
    set({ opSelection: new Set() });
  },

  toggleOpSelected: (id) => {
    const { opSelection } = get();
    const newSelection = new Set(opSelection);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    set({ opSelection: newSelection });
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
    console.log("[CAD iter2] enterPlaneSelectionMode");
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
      activeTool: "select",
    });
  },

  exitSketchMode: () => {
    console.log("[CAD] exitSketchMode");
    set({
      editorMode: "object",
      activeSketchId: null,
      activeTool: "select",
      sketchSelection: new Set(),
      hoveredSketchEntity: null,
      sketchGizmoState: {
        mode: "idle",
        dragStart: null,
        centroidStart: null,
        rotationStart: null,
        originalPositions: null,
      },
    });
  },

  // History actions
  pushHistory: () => {
    const { studio, historyState } = get();
    set({ historyState: pushState(historyState, studio) });
  },

  undo: () => {
    const { historyState } = get();
    const newHistory = undo(historyState);
    set({
      historyState: newHistory,
      studio: newHistory.present,
    });
  },

  redo: () => {
    const { historyState } = get();
    const newHistory = redo(historyState);
    set({
      historyState: newHistory,
      studio: newHistory.present,
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
    const { studio, kernel } = get();
    if (!kernel) return;

    set({ isRebuilding: true, rebuildError: null });

    try {
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
    const { studio, historyState } = get();

    const opNode = studio.opGraph.get(opId);
    if (!opNode) return;

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(opId, { ...opNode, op: { ...opNode.op, ...updates } as Op });

    const newStudio = touchPartStudio({ ...studio, opGraph: newOpGraph });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });
  },

  deleteOp: (opId) => {
    const { studio, historyState, objectSelection, opSelection } = get();

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

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
      sketches: newSketches,
    });

    // Remove from both selections if selected
    const newObjectSelection = new Set(objectSelection);
    newObjectSelection.delete(opId);
    const newOpSelection = new Set(opSelection);
    newOpSelection.delete(opId);

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      objectSelection: newObjectSelection,
      opSelection: newOpSelection,
    });
  },

  // Parameters - now on studio.params instead of document.params
  addParam: (name, value, unit) => {
    const { studio, historyState } = get();
    const param = createParam(name, value, unit);
    const newParams = params.addParam(studio.params, param);
    const newStudio = touchPartStudio({ ...studio, params: newParams });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });
  },

  updateParam: (paramId, updates) => {
    const { studio, historyState } = get();
    const existingParam = studio.params.params.get(paramId);
    if (!existingParam) return;

    const newParamsMap = new Map(studio.params.params);
    newParamsMap.set(paramId, { ...existingParam, ...updates });

    const newParams: ParamEnv = {
      ...studio.params,
      params: newParamsMap,
    };

    // Re-evaluate if expression changed
    const evaluatedParams = params.evaluateParams(newParams);

    const newStudio = touchPartStudio({ ...studio, params: evaluatedParams });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });
  },

  removeParam: (paramId) => {
    const { studio, historyState } = get();
    const newParams = params.removeParam(studio.params, paramId);
    const newStudio = touchPartStudio({ ...studio, params: newParams });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });
  },

  // Sketch/Operation creation
  createNewSketch: (planeId) => {
    const { studio, historyState } = get();

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

    const newStudio = touchPartStudio({
      ...studio,
      sketches: newSketches,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    console.log("[CAD] createNewSketch:", sketch.id, sketch.name);

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      activeSketchId: sketch.id,
      editorMode: "sketch",
      activeTool: "line",
      timelinePosition: null, // Show all ops
    });

    return sketch.id;
  },

  createNewSketchFromFace: (faceRef, center, normal) => {
    const { studio, historyState } = get();

    // Verify the source operation exists
    const sourceOp = studio.opGraph.get(faceRef.opId as OpId);
    if (!sourceOp) {
      console.error("[CAD] createNewSketchFromFace: source operation not found:", faceRef.opId);
      return null;
    }

    // Create a plane from the face center and normal
    const sketchCount = studio.sketches.size + 1;
    const planeName = `Face Plane ${sketchCount}`;
    const plane = createPlaneFromNormal(planeName, center, normal);

    // Create a new empty sketch that references this face
    const sketch = createSketch(`Sketch ${sketchCount}`, plane.id);

    // Create the sketch operation with a TopoRef to the face
    const sketchOpId = newId("Op") as OpId;
    const faceTopoRef: TopoRef = {
      opId: faceRef.opId as OpId,
      subType: "face",
      index: faceRef.faceIndex,
      signature: {
        center,
        normal,
      },
    };

    const sketchOp: SketchOp = {
      id: sketchOpId,
      type: "sketch",
      name: sketch.name,
      suppressed: false,
      sketchId: sketch.id,
      planeRef: faceTopoRef,
    };

    // Update studio with new plane, sketch, and operation
    const newPlanes = new Map(studio.planes);
    newPlanes.set(plane.id, plane);

    const newSketches = new Map(studio.sketches);
    newSketches.set(sketch.id, sketch);

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(sketchOpId, {
      op: sketchOp,
      deps: [faceRef.opId as OpId], // Depend on the source operation
    });

    const newOpOrder = [...studio.opOrder, sketchOpId];

    const newStudio = touchPartStudio({
      ...studio,
      planes: newPlanes,
      sketches: newSketches,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    console.log("[CAD iter2] createNewSketchFromFace:", sketch.id, sketch.name, "on face", faceRef);

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      activeSketchId: sketch.id,
      editorMode: "sketch",
      activeTool: "line",
      timelinePosition: null, // Show all ops
    });

    return sketch.id;
  },

  createExtrude: (sketchId, depth = 100, direction = "normal", loopIndex) => {
    const { studio, historyState } = get();

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
        // If a specific loop was selected, use it; otherwise extrude all loops
        profileIndices: loopIndex !== undefined ? [loopIndex] : undefined,
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

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null, // Show all ops
    });

    return extrudeOpId;
  },

  createExtrudeFromFace: (opId, faceIndex, depth = 100, direction = "normal") => {
    const { studio, historyState } = get();

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

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null,
    });

    return extrudeOpId;
  },

  // Sketch primitive editing
  addPoint: (x, y) => {
    const { studio, activeSketchId, historyState } = get();
    if (!activeSketchId) return null;

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

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });

    return pointId;
  },

  addLine: (startX, startY, endX, endY) => {
    console.log("[CAD] addLine:", { startX, startY, endX, endY });
    const { studio, activeSketchId, historyState } = get();
    if (!activeSketchId) {
      console.log("[CAD] addLine failed: no active sketch", { activeSketchId });
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

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });

    console.log("[CAD] addLine SUCCESS:", lineId, "sketch now has", newPrimitives.size, "primitives");
    return lineId;
  },

  addCircle: (centerX, centerY, radius) => {
    console.log("[CAD] addCircle:", { centerX, centerY, radius });
    const { studio, activeSketchId, historyState } = get();
    if (!activeSketchId) return null;

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

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });

    return circleId;
  },

  addRectangle: (x1, y1, x2, y2) => {
    const { studio, activeSketchId, historyState } = get();
    if (!activeSketchId) return null;

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

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });

    return l1Id; // Return first line as reference
  },

  addArc: (centerX, centerY, startX, startY, endX, endY, clockwise = false) => {
    const { studio, activeSketchId, historyState } = get();
    if (!activeSketchId) return null;

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

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
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

  // Sketch selection actions
  setSketchSelection: (ids) => {
    set({ sketchSelection: ids });
  },

  clearSketchSelection: () => {
    set({ sketchSelection: new Set() });
  },

  toggleSketchEntitySelected: (id) => {
    const { sketchSelection } = get();
    const newSelection = new Set(sketchSelection);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    set({ sketchSelection: newSelection });
  },

  setHoveredSketchEntity: (id) => {
    set({ hoveredSketchEntity: id });
  },

  getMaterializedSelectionPoints: () => {
    const { studio, activeSketchId, sketchSelection } = get();
    if (!activeSketchId) return [];

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return [];

    const pointIds = new Set<PrimitiveId>();

    for (const primId of sketchSelection) {
      const prim = sketch.primitives.get(primId);
      if (!prim) continue;

      if (prim.type === "point") {
        pointIds.add(primId);
      } else {
        // Get all referenced points for non-point primitives
        const refs = getReferencedPoints(prim);
        for (const refId of refs) {
          pointIds.add(refId);
        }
      }
    }

    return Array.from(pointIds);
  },

  updateSketchPointPositions: (updates) => {
    const { studio, activeSketchId, historyState } = get();
    if (!activeSketchId) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    const newPrimitives = new Map(sketch.primitives);
    const newSolvedPositions = new Map(sketch.solvedPositions || []);

    for (const [primId, pos] of updates) {
      const prim = sketch.primitives.get(primId);
      if (prim?.type === "point") {
        // Update the primitive
        newPrimitives.set(primId, { ...prim, x: pos.x, y: pos.y });
        // Update solved positions
        newSolvedPositions.set(primId, [pos.x, pos.y]);
      }
    }

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
    });
  },

  startSketchGizmoDrag: (mode, mousePos) => {
    const { studio, activeSketchId, sketchSelection } = get();
    if (!activeSketchId || sketchSelection.size === 0) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    // Calculate centroid of selected points and store original positions
    const pointIds = get().getMaterializedSelectionPoints();
    if (pointIds.length === 0) return;

    let cx = 0, cy = 0;
    const originalPositions = new Map<PrimitiveId, { x: number; y: number }>();

    for (const pointId of pointIds) {
      const solved = sketch.solvedPositions?.get(pointId);
      let px: number, py: number;
      if (solved) {
        px = solved[0];
        py = solved[1];
      } else {
        const prim = sketch.primitives.get(pointId);
        if (prim?.type === "point") {
          px = prim.x;
          py = prim.y;
        } else {
          continue;
        }
      }
      cx += px;
      cy += py;
      originalPositions.set(pointId, { x: px, y: py });
    }
    cx /= pointIds.length;
    cy /= pointIds.length;

    // Calculate initial rotation angle if in rotate mode
    let rotationStart: number | null = null;
    if (mode === "rotate") {
      rotationStart = Math.atan2(mousePos.y - cy, mousePos.x - cx);
    }

    set({
      sketchGizmoState: {
        mode,
        dragStart: { x: mousePos.x, y: mousePos.y },
        centroidStart: { x: cx, y: cy },
        rotationStart,
        originalPositions,
      },
    });
  },

  updateSketchGizmoDrag: (mousePos) => {
    const { studio, activeSketchId, sketchGizmoState } = get();
    if (!activeSketchId || sketchGizmoState.mode === "idle") return;
    if (!sketchGizmoState.dragStart || !sketchGizmoState.centroidStart || !sketchGizmoState.originalPositions) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    const newPrimitives = new Map(sketch.primitives);
    const newSolvedPositions = new Map(sketch.solvedPositions || []);

    const { mode, dragStart, centroidStart, rotationStart, originalPositions } = sketchGizmoState;

    // Calculate delta from drag start position (in sketch 2D coordinates)
    let dx = mousePos.x - dragStart.x;
    let dy = mousePos.y - dragStart.y;

    // Constrain movement based on mode
    if (mode === "translate-x") {
      dy = 0;
    } else if (mode === "translate-y") {
      dx = 0;
    }

    // Apply transformation to each point using original positions
    for (const [pointId, origPos] of originalPositions) {
      const prim = sketch.primitives.get(pointId);
      if (prim?.type !== "point") continue;

      let newX: number, newY: number;

      if (mode === "rotate" && rotationStart !== null) {
        // For rotation, calculate angle delta
        const currentAngle = Math.atan2(mousePos.y - centroidStart.y, mousePos.x - centroidStart.x);
        const angleDelta = currentAngle - rotationStart;

        // Translate to centroid origin, rotate, translate back
        const relX = origPos.x - centroidStart.x;
        const relY = origPos.y - centroidStart.y;
        const cos = Math.cos(angleDelta);
        const sin = Math.sin(angleDelta);
        newX = centroidStart.x + relX * cos - relY * sin;
        newY = centroidStart.y + relX * sin + relY * cos;
      } else {
        // Translation: apply delta to original position
        newX = origPos.x + dx;
        newY = origPos.y + dy;
      }

      newPrimitives.set(pointId, { ...prim, x: newX, y: newY });
      newSolvedPositions.set(pointId, [newX, newY]);
    }

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    // Don't push history on every drag update - only on end
    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({ studio: newStudio });
  },

  endSketchGizmoDrag: () => {
    const { studio, historyState } = get();

    // Push the final state to history
    set({
      sketchGizmoState: {
        mode: "idle",
        dragStart: null,
        centroidStart: null,
        rotationStart: null,
        originalPositions: null,
      },
      historyState: pushState(historyState, studio),
    });
  },

  // Clipboard operations
  deleteSketchSelection: () => {
    const { studio, activeSketchId, sketchSelection, historyState } = get();
    if (!activeSketchId || sketchSelection.size === 0) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    // Get all primitives to delete (including referenced points for lines/arcs/circles)
    const toDelete = new Set<PrimitiveId>();
    for (const primId of sketchSelection) {
      toDelete.add(primId);
      const prim = sketch.primitives.get(primId);
      if (prim) {
        // Also delete referenced points for non-point primitives
        const refs = getReferencedPoints(prim);
        for (const refId of refs) {
          toDelete.add(refId);
        }
      }
    }

    // Remove primitives and their solved positions
    const newPrimitives = new Map(sketch.primitives);
    const newSolvedPositions = new Map(sketch.solvedPositions || []);
    for (const primId of toDelete) {
      newPrimitives.delete(primId);
      newSolvedPositions.delete(primId);
    }

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      sketchSelection: new Set(),
    });
  },

  copySketchSelection: () => {
    const { studio, activeSketchId, sketchSelection } = get();
    if (!activeSketchId || sketchSelection.size === 0) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    // Collect all primitives to copy (selected + their referenced points)
    const toCopy = new Set<PrimitiveId>();
    for (const primId of sketchSelection) {
      toCopy.add(primId);
      const prim = sketch.primitives.get(primId);
      if (prim) {
        const refs = getReferencedPoints(prim);
        for (const refId of refs) {
          toCopy.add(refId);
        }
      }
    }

    // Deep copy primitives
    const copiedPrimitives = new Map<PrimitiveId, PointPrimitive | LinePrimitive | CirclePrimitive | ArcPrimitive>();
    let cx = 0, cy = 0, pointCount = 0;

    for (const primId of toCopy) {
      const prim = sketch.primitives.get(primId);
      if (!prim) continue;

      // Deep copy (primitives are already immutable, but spread for safety)
      copiedPrimitives.set(primId, { ...prim } as any);

      // Calculate centroid from points only
      if (prim.type === "point") {
        const solved = sketch.solvedPositions?.get(primId);
        if (solved) {
          cx += solved[0];
          cy += solved[1];
        } else {
          cx += prim.x;
          cy += prim.y;
        }
        pointCount++;
      }
    }

    if (pointCount > 0) {
      cx /= pointCount;
      cy /= pointCount;
    }

    set({
      sketchClipboard: {
        primitives: copiedPrimitives,
        centroid: { x: cx, y: cy },
      },
    });
  },

  cutSketchSelection: () => {
    const { copySketchSelection, deleteSketchSelection } = get();
    copySketchSelection();
    deleteSketchSelection();
  },

  pasteSketchClipboard: () => {
    const { studio, activeSketchId, sketchClipboard, sketchMousePos, historyState } = get();
    if (!activeSketchId || !sketchClipboard) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    // Calculate paste offset - paste at mouse position or offset from original
    const pasteOffset = sketchMousePos
      ? { x: sketchMousePos.x - sketchClipboard.centroid.x, y: sketchMousePos.y - sketchClipboard.centroid.y }
      : { x: 20, y: 20 }; // Default offset if no mouse position

    // Create mapping from old IDs to new IDs
    const idMapping = new Map<PrimitiveId, PrimitiveId>();
    for (const oldId of sketchClipboard.primitives.keys()) {
      idMapping.set(oldId, newId("Primitive") as PrimitiveId);
    }

    const newPrimitives = new Map(sketch.primitives);
    const newSolvedPositions = new Map(sketch.solvedPositions || []);
    const pastedIds = new Set<PrimitiveId>();

    // Paste primitives with new IDs and updated references
    for (const [oldId, oldPrim] of sketchClipboard.primitives) {
      const newPrimId = idMapping.get(oldId)!;
      pastedIds.add(newPrimId);

      if (oldPrim.type === "point") {
        const newX = oldPrim.x + pasteOffset.x;
        const newY = oldPrim.y + pasteOffset.y;
        const newPoint: PointPrimitive = {
          ...oldPrim,
          id: newPrimId,
          x: newX,
          y: newY,
        };
        newPrimitives.set(newPrimId, newPoint);
        newSolvedPositions.set(newPrimId, [newX, newY]);
      } else if (oldPrim.type === "line") {
        const newLine: LinePrimitive = {
          ...oldPrim,
          id: newPrimId,
          start: idMapping.get(oldPrim.start) || oldPrim.start,
          end: idMapping.get(oldPrim.end) || oldPrim.end,
        };
        newPrimitives.set(newPrimId, newLine);
      } else if (oldPrim.type === "circle") {
        const newCircle: CirclePrimitive = {
          ...oldPrim,
          id: newPrimId,
          center: idMapping.get(oldPrim.center) || oldPrim.center,
        };
        newPrimitives.set(newPrimId, newCircle);
      } else if (oldPrim.type === "arc") {
        const newArc: ArcPrimitive = {
          ...oldPrim,
          id: newPrimId,
          center: idMapping.get(oldPrim.center) || oldPrim.center,
          start: idMapping.get(oldPrim.start) || oldPrim.start,
          end: idMapping.get(oldPrim.end) || oldPrim.end,
        };
        newPrimitives.set(newPrimId, newArc);
      }
    }

    const newSketch: Sketch = {
      ...sketch,
      primitives: newPrimitives,
      solvedPositions: newSolvedPositions,
    };

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, newSketch);

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      // Select the pasted entities (non-point primitives only for cleaner selection)
      sketchSelection: new Set(
        Array.from(pastedIds).filter((id) => {
          const prim = newPrimitives.get(id);
          return prim && prim.type !== "point";
        })
      ),
    });
  },

  duplicateSketchSelection: () => {
    const { copySketchSelection, pasteSketchClipboard } = get();
    copySketchSelection();
    pasteSketchClipboard();
  },

  selectAllSketchEntities: () => {
    const { studio, activeSketchId } = get();
    if (!activeSketchId) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    // Select all non-point primitives (lines, circles, arcs)
    const allEntities = new Set<PrimitiveId>();
    for (const [id, prim] of sketch.primitives) {
      if (prim.type !== "point") {
        allEntities.add(id);
      }
    }

    set({ sketchSelection: allEntities });
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
    const { faceSelectionTarget, pendingExtrude, studio, historyState } = get();

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

    // If editing an existing sketch's plane
    if (faceSelectionTarget?.type === "edit-sketch-plane") {
      if (face.type === "datum-plane") {
        const { opId, sketchId } = faceSelectionTarget;
        const newPlaneId = face.planeId as SketchPlaneId;

        // Update the SketchOp's planeRef
        const opNode = studio.opGraph.get(opId as OpId);
        if (opNode && opNode.op.type === "sketch") {
          const updatedOp = { ...opNode.op, planeRef: newPlaneId };
          const newOpGraph = new Map(studio.opGraph);
          newOpGraph.set(opId as OpId, { ...opNode, op: updatedOp });

          // Update the Sketch's planeId
          const sketch = studio.sketches.get(sketchId as SketchId);
          if (sketch) {
            const updatedSketch = { ...sketch, planeId: newPlaneId };
            const newSketches = new Map(studio.sketches);
            newSketches.set(sketchId as SketchId, updatedSketch);

            const newStudio = touchPartStudio({ ...studio, opGraph: newOpGraph, sketches: newSketches });
            set({
              studio: newStudio,
              historyState: pushState(historyState, newStudio),
              editorMode: "object",
              faceSelectionTarget: null,
              selectedFace: null,
            });
          }
        }
      } else {
        set({
          editorMode: "object",
          faceSelectionTarget: null,
          selectedFace: null,
        });
      }
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

  setPendingExtrudeSketch: (sketchId, loopIndex) => {
    const { pendingExtrude, opSelection, studio } = get();
    if (pendingExtrude) {
      // Clear body face when setting sketch, exit face selection mode
      set({
        pendingExtrude: { ...pendingExtrude, sketchId, loopIndex, bodyFace: null },
        editorMode: "object",
        faceSelectionTarget: null,
        selectedFace: sketchId ? { type: "sketch-profile", sketchId, loopIndex } : null,
      });
    } else if (opSelection.size === 1 && sketchId) {
      // If no pending extrude but an op is selected, update that op's profile
      const selectedOpId = Array.from(opSelection)[0];
      const opNode = studio.opGraph.get(selectedOpId as OpId);
      if (opNode && opNode.op.type === "extrude") {
        // Update the op with new sketch profile
        const updatedOp = {
          ...opNode.op,
          profile: {
            type: "sketch" as const,
            sketchId: sketchId as SketchId,
            profileIndices: loopIndex !== undefined ? [loopIndex] : undefined,
          },
        };
        const newOpGraph = new Map(studio.opGraph);
        newOpGraph.set(selectedOpId as OpId, { ...opNode, op: updatedOp });
        const newStudio = touchPartStudio({ ...studio, opGraph: newOpGraph });
        set({
          studio: newStudio,
          editorMode: "object",
          faceSelectionTarget: null,
          selectedFace: { type: "sketch-profile", sketchId, loopIndex },
        });
      }
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
      createExtrude(pendingExtrude.sketchId as any, pendingExtrude.depth, pendingExtrude.direction, pendingExtrude.loopIndex);
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
        pendingRevolve: { sketchId: activeSketchId, bodyFace: null, angle: 360, axis: "sketch-x" },
        activeTool: "revolve",
      });
    } else {
      set({
        pendingRevolve: { sketchId: null, bodyFace: null, angle: 360, axis: "sketch-x" },
        activeTool: "revolve",
        editorMode: "select-face",
        faceSelectionTarget: { type: "extrude-profile" },
      });
    }
  },

  setPendingRevolveSketch: (sketchId, loopIndex) => {
    const { pendingRevolve } = get();
    if (pendingRevolve) {
      // Exit face selection mode when sketch is selected, clear body face
      set({
        pendingRevolve: { ...pendingRevolve, sketchId, loopIndex, bodyFace: null },
        editorMode: "object",
        faceSelectionTarget: null,
        selectedFace: sketchId ? { type: "sketch-profile", sketchId, loopIndex } : null,
      });
    }
  },

  setPendingRevolveBodyFace: (bodyFace) => {
    const { pendingRevolve } = get();
    if (pendingRevolve) {
      // Clear sketch when setting body face
      set({
        pendingRevolve: { ...pendingRevolve, bodyFace, sketchId: null },
        editorMode: "object",
        faceSelectionTarget: null,
      });
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

  setPendingRevolveCustomAxis: (origin, direction) => {
    const { pendingRevolve } = get();
    if (pendingRevolve) {
      set({ pendingRevolve: { ...pendingRevolve, axis: "custom", customAxis: { origin, direction } } });
    }
  },

  confirmRevolve: () => {
    const { pendingRevolve, createRevolve, createRevolveFromFace } = get();
    if (pendingRevolve?.sketchId) {
      createRevolve(pendingRevolve.sketchId as any, pendingRevolve.angle, pendingRevolve.axis, pendingRevolve.customAxis);
    } else if (pendingRevolve?.bodyFace) {
      // For body face revolve, derive axis from pending state or use default
      const axis = pendingRevolve.customAxis || { origin: [0, 0, 0] as [number, number, number], direction: [0, 0, 1] as [number, number, number] };
      createRevolveFromFace(
        pendingRevolve.bodyFace.opId,
        pendingRevolve.bodyFace.faceIndex,
        pendingRevolve.angle,
        axis
      );
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

  createRevolve: (sketchId, angle = 360, axis = "sketch-x", customAxis) => {
    const { studio, historyState } = get();

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
      case "custom":
        if (customAxis) {
          axisOrigin = customAxis.origin;
          axisDir = customAxis.direction;
        } else {
          axisDir = [0, 0, 1];
        }
        break;
      default:
        axisDir = plane.axisX as [number, number, number];
        axisOrigin = plane.origin as [number, number, number];
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

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null,
    });

    return revolveOpId;
  },

  createRevolveFromFace: (opId, faceIndex, angle = 360, axis = { origin: [0, 0, 0] as [number, number, number], direction: [0, 0, 1] as [number, number, number] }) => {
    const { studio, historyState } = get();

    // Verify the source operation exists
    const sourceOp = studio.opGraph.get(opId as OpId);
    if (!sourceOp) return null;

    // Create revolve operation with unified profile abstraction (face type)
    const revolveOpId = newId("Op") as OpId;
    const revolveOp: RevolveOp = {
      id: revolveOpId,
      type: "revolve",
      name: `Revolve from ${sourceOp.op.name}`,
      suppressed: false,
      profile: {
        type: "face",
        faceRef: {
          opId: opId as OpId,
          subType: "face",
          index: faceIndex,
        },
      },
      axis: { origin: axis.origin, direction: axis.direction },
      angle: dimLiteral(angle * Math.PI / 180), // Convert to radians
    };

    // Update studio
    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(revolveOpId, {
      op: revolveOp,
      deps: [opId as OpId],
    });

    const newOpOrder = [...studio.opOrder, revolveOpId];

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
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
    const { studio, historyState } = get();

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

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
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
    const { studio, historyState } = get();

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

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null,
    });

    return booleanOpId;
  },

  // Primitive solid workflow
  startPrimitive: (type) => {
    const defaultPrimitives = {
      box: {
        type: "box" as const,
        center: [0, 0, 0] as Vec3,
        dimensions: [50, 50, 50] as Vec3,
      },
      cylinder: {
        type: "cylinder" as const,
        center: [0, 0, 0] as Vec3,
        axis: [0, 0, 1] as Vec3,
        radius: 25,
        height: 50,
      },
      sphere: {
        type: "sphere" as const,
        center: [0, 0, 0] as Vec3,
        radius: 25,
      },
      cone: {
        type: "cone" as const,
        center: [0, 0, 0] as Vec3,
        axis: [0, 0, 1] as Vec3,
        radius1: 25,
        radius2: 0,
        height: 50,
      },
    };
    set({
      pendingPrimitive: defaultPrimitives[type],
      activeTool: type,
    });
  },

  updatePendingPrimitive: (updates) => {
    const { pendingPrimitive } = get();
    if (pendingPrimitive) {
      set({ pendingPrimitive: { ...pendingPrimitive, ...updates } as typeof pendingPrimitive });
    }
  },

  confirmPrimitive: () => {
    const { pendingPrimitive, createBox, createCylinder, createSphere, createCone } = get();
    if (!pendingPrimitive) return;

    switch (pendingPrimitive.type) {
      case "box":
        createBox(pendingPrimitive.center, pendingPrimitive.dimensions);
        break;
      case "cylinder":
        createCylinder(pendingPrimitive.center, pendingPrimitive.axis, pendingPrimitive.radius, pendingPrimitive.height);
        break;
      case "sphere":
        createSphere(pendingPrimitive.center, pendingPrimitive.radius);
        break;
      case "cone":
        createCone(pendingPrimitive.center, pendingPrimitive.axis, pendingPrimitive.radius1, pendingPrimitive.radius2, pendingPrimitive.height);
        break;
    }

    set({
      pendingPrimitive: null,
      activeTool: "select",
    });
  },

  cancelPrimitive: () => {
    set({
      pendingPrimitive: null,
      activeTool: "select",
    });
  },

  createBox: (center, dimensions) => {
    const { studio, historyState } = get();

    const boxOpId = newId("Op") as OpId;
    const boxOp: BoxOp = {
      id: boxOpId,
      type: "box",
      name: "Box",
      suppressed: false,
      center,
      dimensions,
    };

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(boxOpId, { op: boxOp, deps: [] });

    const newOpOrder = [...studio.opOrder, boxOpId];

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null,
    });

    return boxOpId;
  },

  createCylinder: (center, axis, radius, height) => {
    const { studio, historyState } = get();

    const cylinderOpId = newId("Op") as OpId;
    const cylinderOp: CylinderOp = {
      id: cylinderOpId,
      type: "cylinder",
      name: "Cylinder",
      suppressed: false,
      center,
      axis,
      radius: dimLiteral(radius),
      height: dimLiteral(height),
    };

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(cylinderOpId, { op: cylinderOp, deps: [] });

    const newOpOrder = [...studio.opOrder, cylinderOpId];

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null,
    });

    return cylinderOpId;
  },

  createSphere: (center, radius) => {
    const { studio, historyState } = get();

    const sphereOpId = newId("Op") as OpId;
    const sphereOp: SphereOp = {
      id: sphereOpId,
      type: "sphere",
      name: "Sphere",
      suppressed: false,
      center,
      radius: dimLiteral(radius),
    };

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(sphereOpId, { op: sphereOp, deps: [] });

    const newOpOrder = [...studio.opOrder, sphereOpId];

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null,
    });

    return sphereOpId;
  },

  createCone: (center, axis, radius1, radius2, height) => {
    const { studio, historyState } = get();

    const coneOpId = newId("Op") as OpId;
    const coneOp: ConeOp = {
      id: coneOpId,
      type: "cone",
      name: "Cone",
      suppressed: false,
      center,
      axis,
      radius1: dimLiteral(radius1),
      radius2: dimLiteral(radius2),
      height: dimLiteral(height),
    };

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(coneOpId, { op: coneOp, deps: [] });

    const newOpOrder = [...studio.opOrder, coneOpId];

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null,
    });

    return coneOpId;
  },

  // Transform workflow
  startTransform: (type) => {
    set({
      pendingTransform: {
        targetOpId: null,
        transformType: type,
        translation: [0, 0, 0],
        rotationOrigin: [0, 0, 0],
        rotationAxis: [0, 0, 1],
        rotationAngle: 0,
        scaleFactor: 1,
        scaleCenter: [0, 0, 0],
      },
      activeTool: `transform-${type}`,
    });
  },

  setPendingTransformTarget: (opId) => {
    const { pendingTransform } = get();
    if (pendingTransform) {
      set({ pendingTransform: { ...pendingTransform, targetOpId: opId } });
    }
  },

  updatePendingTransform: (updates) => {
    const { pendingTransform } = get();
    if (pendingTransform) {
      set({ pendingTransform: { ...pendingTransform, ...updates } });
    }
  },

  confirmTransform: () => {
    const { pendingTransform, createTransform } = get();
    if (!pendingTransform?.targetOpId) return;

    createTransform(
      pendingTransform.targetOpId as OpId,
      pendingTransform.transformType,
      {
        translation: pendingTransform.translation,
        rotationOrigin: pendingTransform.rotationOrigin,
        rotationAxis: pendingTransform.rotationAxis,
        rotationAngle: pendingTransform.rotationAngle,
        scaleFactor: pendingTransform.scaleFactor,
        scaleCenter: pendingTransform.scaleCenter,
      }
    );

    set({
      pendingTransform: null,
      activeTool: "select",
    });
  },

  cancelTransform: () => {
    set({
      pendingTransform: null,
      activeTool: "select",
    });
  },

  createTransform: (targetOpId, transformType, transformParams) => {
    const { studio, historyState } = get();

    const targetOp = studio.opGraph.get(targetOpId);
    if (!targetOp) return null;

    const transformOpId = newId("Op") as OpId;
    const transformOp: TransformOp = {
      id: transformOpId,
      type: "transform",
      name: `${transformType.charAt(0).toUpperCase() + transformType.slice(1)} ${targetOp.op.name}`,
      suppressed: false,
      targetOp: targetOpId,
      transformType: transformType,
      translation: transformParams.translation,
      rotationOrigin: transformParams.rotationOrigin,
      rotationAxis: transformParams.rotationAxis,
      rotationAngle: transformParams.rotationAngle !== undefined ? dimLiteral(transformParams.rotationAngle * Math.PI / 180) : undefined,
      scaleFactor: transformParams.scaleFactor !== undefined ? dimLiteral(transformParams.scaleFactor) : undefined,
      scaleCenter: transformParams.scaleCenter,
    };

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(transformOpId, {
      op: transformOp,
      deps: [targetOpId],
    });

    const newOpOrder = [...studio.opOrder, transformOpId];

    const newStudio = touchPartStudio({
      ...studio,
      opGraph: newOpGraph,
      opOrder: newOpOrder,
    });

    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      timelinePosition: null,
    });

    return transformOpId;
  },

  setHoveredFace: (face) => {
    set({ hoveredFace: face });
  },

  setExportMeshes: (meshes) => {
    set({ exportMeshes: meshes });
  },

  setExportShapeHandles: (handles) => {
    set({ exportShapeHandles: handles });
  },

  resetDocument: () => {
    set(createInitialState());
  },

  // Constraint actions
  startConstraint: (type) => {
    set({
      pendingConstraint: {
        type,
        entities: [],
        dimension: undefined,
      },
      activeTool: `constraint-${type}`,
    });
  },

  addConstraintEntity: (primitiveId) => {
    const { pendingConstraint } = get();
    if (!pendingConstraint) return;

    // Add entity if not already in list
    if (!pendingConstraint.entities.includes(primitiveId)) {
      set({
        pendingConstraint: {
          ...pendingConstraint,
          entities: [...pendingConstraint.entities, primitiveId],
        },
      });
    }
  },

  setConstraintDimension: (value) => {
    const { pendingConstraint } = get();
    if (!pendingConstraint) return;

    set({
      pendingConstraint: {
        ...pendingConstraint,
        dimension: value,
      },
    });
  },

  confirmConstraint: () => {
    const { studio, activeSketchId, pendingConstraint, historyState, kernel } = get();
    if (!activeSketchId || !pendingConstraint) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    // Check if we have enough entities for this constraint type
    const { type, entities, dimension } = pendingConstraint;
    let updatedSketch: Sketch | null = null;

    try {
      switch (type) {
        case "coincident":
          if (entities.length >= 2) {
            const result = sketchOps.addCoincident(sketch, entities[0], entities[1]);
            updatedSketch = result.sketch;
          }
          break;
        case "horizontal":
          if (entities.length >= 1) {
            const result = sketchOps.addHorizontal(sketch, ...entities);
            updatedSketch = result.sketch;
          }
          break;
        case "vertical":
          if (entities.length >= 1) {
            const result = sketchOps.addVertical(sketch, ...entities);
            updatedSketch = result.sketch;
          }
          break;
        case "parallel":
          if (entities.length >= 2) {
            const result = sketchOps.addParallel(sketch, entities[0], entities[1]);
            updatedSketch = result.sketch;
          }
          break;
        case "perpendicular":
          if (entities.length >= 2) {
            const result = sketchOps.addPerpendicular(sketch, entities[0], entities[1]);
            updatedSketch = result.sketch;
          }
          break;
        case "equal":
          if (entities.length >= 2) {
            const result = sketchOps.addEqual(sketch, entities[0], entities[1]);
            updatedSketch = result.sketch;
          }
          break;
        case "fixed":
          if (entities.length >= 1) {
            const result = sketchOps.addFixed(sketch, entities[0]);
            updatedSketch = result.sketch;
          }
          break;
        case "distance":
          if (entities.length >= 2 && dimension !== undefined) {
            const result = sketchOps.addDistance(sketch, entities[0], entities[1], dimension);
            updatedSketch = result.sketch;
          }
          break;
        case "angle":
          if (entities.length >= 2 && dimension !== undefined) {
            // Convert degrees to radians for angle
            const result = sketchOps.addAngle(sketch, entities[0], entities[1], dimension * Math.PI / 180);
            updatedSketch = result.sketch;
          }
          break;
        case "radius":
          if (entities.length >= 1 && dimension !== undefined) {
            const result = sketchOps.addRadius(sketch, entities[0], dimension);
            updatedSketch = result.sketch;
          }
          break;
      }

      if (updatedSketch) {
        // Solve the sketch if kernel is available
        if (kernel) {
          try {
            const solveResult = sketchOps.solveSketch(updatedSketch, kernel.gcs);
            updatedSketch = sketchOps.applysolvedPositions(updatedSketch, solveResult);
          } catch (e) {
            console.warn("[CAD] Failed to solve sketch after adding constraint:", e);
          }
        }

        const newSketches = new Map(studio.sketches);
        newSketches.set(activeSketchId, updatedSketch);

        const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
        set({
          studio: newStudio,
          historyState: pushState(historyState, newStudio),
          pendingConstraint: null,
          activeTool: "select",
          currentSketchSolveStatus: updatedSketch.solveStatus ?? null,
          currentSketchDof: updatedSketch.dof ?? null,
        });
      }
    } catch (e) {
      console.error("[CAD] Failed to add constraint:", e);
      set({ pendingConstraint: null, activeTool: "select" });
    }
  },

  cancelConstraint: () => {
    set({
      pendingConstraint: null,
      activeTool: "select",
    });
  },

  deleteConstraint: (constraintId) => {
    const { studio, activeSketchId, historyState, kernel } = get();
    if (!activeSketchId) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch) return;

    let updatedSketch = sketchOps.removeConstraint(sketch, constraintId);

    // Re-solve after removing constraint
    if (kernel && updatedSketch.constraints.size > 0) {
      try {
        const solveResult = sketchOps.solveSketch(updatedSketch, kernel.gcs);
        updatedSketch = sketchOps.applysolvedPositions(updatedSketch, solveResult);
      } catch (e) {
        console.warn("[CAD] Failed to solve sketch after removing constraint:", e);
      }
    }

    const newSketches = new Map(studio.sketches);
    newSketches.set(activeSketchId, updatedSketch);

    const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
    set({
      studio: newStudio,
      historyState: pushState(historyState, newStudio),
      currentSketchSolveStatus: updatedSketch.solveStatus ?? null,
      currentSketchDof: updatedSketch.dof ?? null,
    });
  },

  solveActiveSketch: () => {
    const { studio, activeSketchId, historyState, kernel } = get();
    if (!activeSketchId || !kernel) return;

    const sketch = studio.sketches.get(activeSketchId);
    if (!sketch || sketch.constraints.size === 0) return;

    try {
      const solveResult = sketchOps.solveSketch(sketch, kernel.gcs);
      const updatedSketch = sketchOps.applysolvedPositions(sketch, solveResult);

      const newSketches = new Map(studio.sketches);
      newSketches.set(activeSketchId, updatedSketch);

      const newStudio = touchPartStudio({ ...studio, sketches: newSketches });
      set({
        studio: newStudio,
        historyState: pushState(historyState, newStudio),
        currentSketchSolveStatus: updatedSketch.solveStatus ?? null,
        currentSketchDof: updatedSketch.dof ?? null,
      });
    } catch (e) {
      console.error("[CAD] Failed to solve sketch:", e);
    }
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectStudio = (state: CadStore) => state.studio;
// Legacy compatibility - components using selectDocument will get studio
export const selectDocument = (state: CadStore) => state.studio;
export const selectActiveStudio = (state: CadStore) => state.studio;
export const selectActiveSketch = (state: CadStore) => {
  const { studio, activeSketchId } = state;
  if (!activeSketchId) return null;
  return studio.sketches.get(activeSketchId) ?? null;
};
export const selectParams = (state: CadStore) => state.studio.params;
export const selectObjectSelection = (state: CadStore) => state.objectSelection;
export const selectOpSelection = (state: CadStore) => state.opSelection;
export const selectIsRebuilding = (state: CadStore) => state.isRebuilding;
export const selectTimelinePosition = (state: CadStore) => state.timelinePosition;
export const selectExportMeshes = (state: CadStore) => state.exportMeshes;
export const selectExportShapeHandles = (state: CadStore) => state.exportShapeHandles;
export const selectPendingConstraint = (state: CadStore) => state.pendingConstraint;
export const selectCurrentSketchSolveStatus = (state: CadStore) => state.currentSketchSolveStatus;
export const selectCurrentSketchDof = (state: CadStore) => state.currentSketchDof;
