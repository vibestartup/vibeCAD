/**
 * PCB Store - state management for PCB editor
 */

import { create } from "zustand";
import type {
  LayerId,
  FootprintId,
  FootprintInstanceId,
  TraceId,
  ViaId,
  CopperPourId,
  NetId,
  PadId,
  NetClassId,
} from "@vibecad/core";
// Import Pcb namespace - access functions through namespace to avoid module init timing issues
import { Vec2, Pcb, newId } from "@vibecad/core";

// Re-export types from Pcb namespace for convenience
type PcbDocument = Pcb.PcbDocument;
type Footprint = Pcb.Footprint;
type FootprintInstance = Pcb.FootprintInstance;
type Trace = Pcb.Trace;
type Via = Pcb.Via;
type CopperPour = Pcb.CopperPour;
type DesignRules = Pcb.DesignRules;
type DrcViolation = Pcb.DrcViolation;
type PcbNet = Pcb.PcbNet;
type PcbNetClass = Pcb.PcbNetClass;
import { HistoryState, createHistory, pushState, undo as historyUndo, redo as historyRedo } from "@vibecad/core";

// ============================================================================
// Types
// ============================================================================

export type PcbEditorMode =
  | "select" // Select/move components and traces
  | "place-footprint" // Placing a footprint from library
  | "route" // Interactive routing
  | "draw-track" // Manual track drawing
  | "draw-zone" // Drawing copper pours
  | "draw-keepout" // Drawing keepout areas
  | "measure" // Measurement tool
  | "edit-outline"; // Editing board outline

export type PcbTool =
  | "select"
  | "track"
  | "via"
  | "zone"
  | "keepout"
  | "line" // Board outline
  | "arc" // Board outline
  | "circle" // Board outline
  | "text"
  | "dimension"
  | "measure"
  | "delete";

export type RoutingMode = "single" | "diff_pair" | "bus";

// ============================================================================
// State Interface
// ============================================================================

interface PcbState {
  // Document (null until initialized)
  pcb: PcbDocument | null;

  // History (null until initialized)
  historyState: HistoryState<PcbDocument> | null;

  // View state
  viewOffset: { x: number; y: number };
  zoom: number;

  // Layer visibility
  layerVisibility: Map<LayerId, boolean>;
  activeLayer: LayerId | null;

  // Editor state
  mode: PcbEditorMode;
  activeTool: PcbTool;

  // Selection
  selectedInstances: Set<FootprintInstanceId>;
  selectedTraces: Set<TraceId>;
  selectedVias: Set<ViaId>;
  selectedPours: Set<CopperPourId>;

  // Hover
  hoveredInstance: FootprintInstanceId | null;
  hoveredTrace: TraceId | null;
  hoveredVia: ViaId | null;
  hoveredPad: { instanceId: FootprintInstanceId; padId: PadId } | null;

  // Mouse position (in PCB coordinates, mm)
  mousePos: Vec2 | null;

  // Routing state
  routing: {
    netId: NetId | null;
    layerId: LayerId | null;
    traceWidth: number;
    points: Vec2[];
    startPad?: { instanceId: FootprintInstanceId; padId: PadId };
  } | null;

  // Footprint placement state
  pendingFootprint: {
    footprintId: FootprintId;
    rotation: number;
    side: "top" | "bottom";
  } | null;

  // Zone drawing state
  zoneDrawing: {
    netId: NetId | null;
    points: Vec2[];
  } | null;

  // DRC
  showDrcViolations: boolean;
  drcRunning: boolean;

  // 3D view
  show3dView: boolean;

  // Ratsnest
  showRatsnest: boolean;

  // Grid
  gridSize: number; // mm
  snapToGrid: boolean;

  // Library browser
  libraryBrowserOpen: boolean;
}

// ============================================================================
// Actions Interface
// ============================================================================

interface PcbActions {
  // Document management
  initPcb: () => void; // Initialize PCB if null (call on component mount)
  setPcb: (doc: PcbDocument) => void;
  newPcb: (name: string, width?: number, height?: number) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // View
  pan: (dx: number, dy: number) => void;
  setViewOffset: (offset: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitBoard: () => void;
  setMousePos: (pos: Vec2 | null) => void;

  // Layer management
  setActiveLayer: (layerId: LayerId) => void;
  setLayerVisibility: (layerId: LayerId, visible: boolean) => void;
  toggleLayerVisibility: (layerId: LayerId) => void;
  showAllLayers: () => void;
  hideAllLayers: () => void;

  // Mode/Tool
  setMode: (mode: PcbEditorMode) => void;
  setTool: (tool: PcbTool) => void;

  // Footprint operations
  addFootprintToLibrary: (footprint: Footprint) => void;
  startPlaceFootprint: (footprintId: FootprintId) => void;
  cancelPlaceFootprint: () => void;
  rotatePendingFootprint: (angle?: number) => void;
  flipPendingFootprint: () => void;
  placeFootprint: (position: Vec2, refDes: string, value?: string) => FootprintInstanceId | null;

  // Instance operations
  moveSelectedInstances: (delta: Vec2) => void;
  rotateSelectedInstances: (angle?: number) => void;
  flipSelectedInstances: () => void;
  lockSelectedInstances: () => void;
  unlockSelectedInstances: () => void;
  deleteSelectedInstances: () => void;

  // Routing operations
  startRoute: (
    position: Vec2,
    netId: NetId | null,
    startPad?: { instanceId: FootprintInstanceId; padId: PadId }
  ) => void;
  addRoutePoint: (position: Vec2) => void;
  finishRoute: (endPad?: { instanceId: FootprintInstanceId; padId: PadId }) => TraceId | null;
  cancelRoute: () => void;
  setRouteWidth: (width: number) => void;
  switchRouteLayer: () => void;
  placeViaAndSwitchLayer: () => ViaId | null;

  // Trace operations
  deleteSelectedTraces: () => void;
  setTraceNet: (traceId: TraceId, netId: NetId) => void;

  // Via operations
  placeVia: (position: Vec2, netId: NetId) => ViaId | null;
  deleteSelectedVias: () => void;

  // Zone operations
  startZone: (netId: NetId | null) => void;
  addZonePoint: (position: Vec2) => void;
  finishZone: () => CopperPourId | null;
  cancelZone: () => void;
  deleteSelectedZones: () => void;
  refillAllZones: () => void;

  // Net operations
  setNetClass: (netId: NetId, classId: NetClassId) => void;

  // DRC
  runDrc: () => void;
  clearDrc: () => void;
  toggleDrcViolations: () => void;

  // Selection
  selectInstance: (instanceId: FootprintInstanceId, addToSelection?: boolean) => void;
  selectTrace: (traceId: TraceId, addToSelection?: boolean) => void;
  selectVia: (viaId: ViaId, addToSelection?: boolean) => void;
  selectPour: (pourId: CopperPourId, addToSelection?: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;
  deleteSelection: () => void;

  // Hover
  setHoveredInstance: (instanceId: FootprintInstanceId | null) => void;
  setHoveredTrace: (traceId: TraceId | null) => void;
  setHoveredVia: (viaId: ViaId | null) => void;
  setHoveredPad: (pad: { instanceId: FootprintInstanceId; padId: PadId } | null) => void;

  // Grid
  setGridSize: (size: number) => void;
  toggleSnapToGrid: () => void;

  // View toggles
  toggle3dView: () => void;
  toggleRatsnest: () => void;

  // Library browser
  toggleLibraryBrowser: () => void;

  // Board outline
  setBoardOutline: (outline: Vec2[]) => void;

  // Design rules
  setDesignRules: (rules: DesignRules) => void;

  // Linked schematic
  linkSchematic: (path: string) => void;
  unlinkSchematic: () => void;

  // Clipboard
  copySelection: () => void;
  cutSelection: () => void;
  paste: (position: Vec2) => void;

  // Query helpers
  getFootprint: (footprintId: FootprintId) => Footprint | undefined;
  getInstance: (instanceId: FootprintInstanceId) => FootprintInstance | undefined;
  getTrace: (traceId: TraceId) => Trace | undefined;
  getVia: (viaId: ViaId) => Via | undefined;
  getActiveLayerTraces: () => Trace[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function snapToGrid(pos: Vec2, gridSize: number): Vec2 {
  return [
    Math.round(pos[0] / gridSize) * gridSize,
    Math.round(pos[1] / gridSize) * gridSize,
  ];
}

function getNextRefDes(pcb: PcbDocument, prefix: string): string {
  let maxNum = 0;
  for (const instance of pcb.instances.values()) {
    if (instance.refDes.startsWith(prefix)) {
      const num = parseInt(instance.refDes.slice(prefix.length), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `${prefix}${maxNum + 1}`;
}

// ============================================================================
// Store
// ============================================================================

export const usePcbStore = create<PcbState & PcbActions>()((set, get) => {
  return {
    // Initial state - null until initPcb() is called
    pcb: null,
    historyState: null,

    viewOffset: { x: 0, y: 0 },
    zoom: 1,

    layerVisibility: new Map(),
    activeLayer: null,

    mode: "select",
    activeTool: "select",

    selectedInstances: new Set(),
    selectedTraces: new Set(),
    selectedVias: new Set(),
    selectedPours: new Set(),

    hoveredInstance: null,
    hoveredTrace: null,
    hoveredVia: null,
    hoveredPad: null,

    mousePos: null,

    routing: null,
    pendingFootprint: null,
    zoneDrawing: null,

    showDrcViolations: true,
    drcRunning: false,

    show3dView: false,
    showRatsnest: true,

    gridSize: 0.5, // 0.5mm
    snapToGrid: true,

    libraryBrowserOpen: false,

    // ========================================
    // Document management
    // ========================================

    initPcb: () => {
      if (get().pcb === null) {
        const initialPcb = Pcb.createPcbDocumentWithBoard("Untitled PCB", 100, 100);
        const topLayer = Pcb.getTopCopperLayer(initialPcb);

        // Initialize layer visibility
        const layerVisibility = new Map<LayerId, boolean>();
        for (const layerId of initialPcb.layers.keys()) {
          layerVisibility.set(layerId, true);
        }

        set({
          pcb: initialPcb,
          historyState: createHistory(initialPcb),
          layerVisibility,
          activeLayer: topLayer,
        });
      }
    },

    setPcb: (doc) => {
      const layerVisibility = new Map<LayerId, boolean>();
      for (const layerId of doc.layers.keys()) {
        layerVisibility.set(layerId, true);
      }

      set({
        pcb: doc,
        historyState: createHistory(doc),
        layerVisibility,
        activeLayer: Pcb.getTopCopperLayer(doc),
        selectedInstances: new Set(),
        selectedTraces: new Set(),
        selectedVias: new Set(),
        selectedPours: new Set(),
        routing: null,
        pendingFootprint: null,
        zoneDrawing: null,
      });
    },

    newPcb: (name, width = 100, height = 100) => {
      const doc = Pcb.createPcbDocumentWithBoard(name, width, height);
      const layerVisibility = new Map<LayerId, boolean>();
      for (const layerId of doc.layers.keys()) {
        layerVisibility.set(layerId, true);
      }

      set({
        pcb: doc,
        historyState: createHistory(doc),
        layerVisibility,
        activeLayer: Pcb.getTopCopperLayer(doc),
        selectedInstances: new Set(),
        selectedTraces: new Set(),
        selectedVias: new Set(),
        selectedPours: new Set(),
        routing: null,
        pendingFootprint: null,
        zoneDrawing: null,
        viewOffset: { x: 0, y: 0 },
        zoom: 1,
      });
    },

    // ========================================
    // History
    // ========================================

    pushHistory: () => {
      set((state) => {
        if (!state.historyState || !state.pcb) return state;
        return { historyState: pushState(state.historyState, state.pcb) };
      });
    },

    undo: () => {
      const { historyState } = get();
      if (!historyState) return;
      const result = historyUndo(historyState);
      if (result) {
        set({
          pcb: result.present,
          historyState: result,
          selectedInstances: new Set(),
          selectedTraces: new Set(),
          selectedVias: new Set(),
          selectedPours: new Set(),
        });
      }
    },

    redo: () => {
      const { historyState } = get();
      if (!historyState) return;
      const result = historyRedo(historyState);
      if (result) {
        set({
          pcb: result.present,
          historyState: result,
          selectedInstances: new Set(),
          selectedTraces: new Set(),
          selectedVias: new Set(),
          selectedPours: new Set(),
        });
      }
    },

    canUndo: () => (get().historyState?.past.length ?? 0) > 0,
    canRedo: () => (get().historyState?.future.length ?? 0) > 0,

    // ========================================
    // View
    // ========================================

    pan: (dx, dy) => {
      set((state) => ({
        viewOffset: {
          x: state.viewOffset.x + dx,
          y: state.viewOffset.y + dy,
        },
      }));
    },

    setViewOffset: (offset) => set({ viewOffset: offset }),

    setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(50, zoom)) }),

    zoomIn: () => set((state) => ({ zoom: Math.min(50, state.zoom * 1.2) })),

    zoomOut: () => set((state) => ({ zoom: Math.max(0.1, state.zoom / 1.2) })),

    fitBoard: () => {
      const { pcb } = get();
      if (!pcb) return;
      const bounds = Pcb.getBoardBounds(pcb);
      // TODO: Calculate proper view offset and zoom to fit board
      set({ viewOffset: { x: 0, y: 0 }, zoom: 1 });
    },

    setMousePos: (pos) => set({ mousePos: pos }),

    // ========================================
    // Layer management
    // ========================================

    setActiveLayer: (layerId) => {
      const { pcb } = get();
      if (pcb?.layers.has(layerId)) {
        set({ activeLayer: layerId });
      }
    },

    setLayerVisibility: (layerId, visible) => {
      set((state) => {
        const newVisibility = new Map(state.layerVisibility);
        newVisibility.set(layerId, visible);
        return { layerVisibility: newVisibility };
      });
    },

    toggleLayerVisibility: (layerId) => {
      set((state) => {
        const newVisibility = new Map(state.layerVisibility);
        newVisibility.set(layerId, !newVisibility.get(layerId));
        return { layerVisibility: newVisibility };
      });
    },

    showAllLayers: () => {
      set((state) => {
        const newVisibility = new Map(state.layerVisibility);
        for (const layerId of newVisibility.keys()) {
          newVisibility.set(layerId, true);
        }
        return { layerVisibility: newVisibility };
      });
    },

    hideAllLayers: () => {
      set((state) => {
        const newVisibility = new Map(state.layerVisibility);
        for (const layerId of newVisibility.keys()) {
          newVisibility.set(layerId, false);
        }
        return { layerVisibility: newVisibility };
      });
    },

    // ========================================
    // Mode/Tool
    // ========================================

    setMode: (mode) => {
      set({
        mode,
        routing: null,
        pendingFootprint: null,
        zoneDrawing: null,
      });
    },

    setTool: (tool) => {
      let mode: PcbEditorMode = "select";
      if (tool === "track") {
        mode = "route";
      } else if (tool === "zone" || tool === "keepout") {
        mode = "draw-zone";
      } else if (tool === "line" || tool === "arc" || tool === "circle") {
        mode = "edit-outline";
      } else if (tool === "measure") {
        mode = "measure";
      }
      set({
        activeTool: tool,
        mode,
        routing: null,
      });
    },

    // ========================================
    // Footprint operations
    // ========================================

    addFootprintToLibrary: (footprint) => {
      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.addFootprint(state.pcb, footprint),
        };
      });
    },

    startPlaceFootprint: (footprintId) => {
      set({
        mode: "place-footprint",
        pendingFootprint: {
          footprintId,
          rotation: 0,
          side: "top",
        },
      });
    },

    cancelPlaceFootprint: () => {
      set({
        mode: "select",
        pendingFootprint: null,
      });
    },

    rotatePendingFootprint: (angle = 90) => {
      set((state) => {
        if (!state.pendingFootprint) return state;
        const newRotation = (state.pendingFootprint.rotation + angle) % 360;
        return {
          pendingFootprint: {
            ...state.pendingFootprint,
            rotation: newRotation < 0 ? newRotation + 360 : newRotation,
          },
        };
      });
    },

    flipPendingFootprint: () => {
      set((state) => {
        if (!state.pendingFootprint) return state;
        return {
          pendingFootprint: {
            ...state.pendingFootprint,
            side: state.pendingFootprint.side === "top" ? "bottom" : "top",
          },
        };
      });
    },

    placeFootprint: (position, refDes, value = "") => {
      const { pcb, pendingFootprint, gridSize, snapToGrid: snap } = get();
      if (!pendingFootprint || !pcb) return null;

      const footprint = pcb.footprints.get(pendingFootprint.footprintId);
      if (!footprint) return null;

      get().pushHistory();

      const snappedPos = snap ? snapToGrid(position, gridSize) : position;

      let instance = Pcb.createFootprintInstance(
        pendingFootprint.footprintId,
        snappedPos,
        refDes,
        value
      );

      // Apply rotation and side
      instance = {
        ...instance,
        rotation: pendingFootprint.rotation,
        side: pendingFootprint.side,
      };

      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.addFootprintInstance(state.pcb, instance),
        };
      });

      return instance.id;
    },

    // ========================================
    // Instance operations
    // ========================================

    moveSelectedInstances: (delta) => {
      const { pcb, selectedInstances, gridSize, snapToGrid: snap } = get();
      if (selectedInstances.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const instanceId of selectedInstances) {
        const instance = doc.instances.get(instanceId);
        if (instance && !instance.locked) {
          const newPos: Vec2 = [
            instance.position[0] + delta[0],
            instance.position[1] + delta[1],
          ];
          const snappedPos = snap ? snapToGrid(newPos, gridSize) : newPos;
          doc = Pcb.updateFootprintInstance(doc, Pcb.moveFootprintInstance(instance, snappedPos));
        }
      }

      set({ pcb: doc });
    },

    rotateSelectedInstances: (angle = 90) => {
      const { pcb, selectedInstances } = get();
      if (selectedInstances.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const instanceId of selectedInstances) {
        const instance = doc.instances.get(instanceId);
        if (instance && !instance.locked) {
          doc = Pcb.updateFootprintInstance(doc, Pcb.rotateFootprintInstance(instance, angle));
        }
      }

      set({ pcb: doc });
    },

    flipSelectedInstances: () => {
      const { pcb, selectedInstances } = get();
      if (selectedInstances.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const instanceId of selectedInstances) {
        const instance = doc.instances.get(instanceId);
        if (instance && !instance.locked) {
          doc = Pcb.updateFootprintInstance(doc, Pcb.flipFootprintInstance(instance));
        }
      }

      set({ pcb: doc });
    },

    lockSelectedInstances: () => {
      const { pcb, selectedInstances } = get();
      if (selectedInstances.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const instanceId of selectedInstances) {
        const instance = doc.instances.get(instanceId);
        if (instance) {
          doc = Pcb.updateFootprintInstance(doc, Pcb.setFootprintInstanceLocked(instance, true));
        }
      }

      set({ pcb: doc });
    },

    unlockSelectedInstances: () => {
      const { pcb, selectedInstances } = get();
      if (selectedInstances.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const instanceId of selectedInstances) {
        const instance = doc.instances.get(instanceId);
        if (instance) {
          doc = Pcb.updateFootprintInstance(doc, Pcb.setFootprintInstanceLocked(instance, false));
        }
      }

      set({ pcb: doc });
    },

    deleteSelectedInstances: () => {
      const { pcb, selectedInstances } = get();
      if (selectedInstances.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const instanceId of selectedInstances) {
        const instance = doc.instances.get(instanceId);
        if (instance && !instance.locked) {
          doc = Pcb.deleteFootprintInstance(doc, instanceId);
        }
      }

      set({
        pcb: doc,
        selectedInstances: new Set(),
      });
    },

    // ========================================
    // Routing operations
    // ========================================

    startRoute: (position, netId, startPad) => {
      const { activeLayer, gridSize, snapToGrid: snap, pcb } = get();
      if (!activeLayer || !pcb) return;

      const snappedPos = snap ? snapToGrid(position, gridSize) : position;

      // Get default trace width from design rules
      const traceWidth = pcb.designRules.minTraceWidth;

      set({
        mode: "route",
        routing: {
          netId,
          layerId: activeLayer,
          traceWidth,
          points: [snappedPos],
          startPad,
        },
      });
    },

    addRoutePoint: (position) => {
      const { routing, gridSize, snapToGrid: snap } = get();
      if (!routing) return;

      const snappedPos = snap ? snapToGrid(position, gridSize) : position;

      // Add point (with optional 45/90 degree routing)
      const lastPoint = routing.points[routing.points.length - 1];
      const newPoints = [...routing.points];

      // For now, allow any angle - can add 45/90 degree constraint later
      newPoints.push(snappedPos);

      set({
        routing: { ...routing, points: newPoints },
      });
    },

    finishRoute: (endPad) => {
      const { pcb, routing } = get();
      if (!routing || routing.points.length < 2 || !routing.layerId) {
        set({ routing: null });
        return null;
      }

      get().pushHistory();

      const netId = routing.netId || ("unrouted" as NetId);
      const trace = Pcb.createTraceFromPoints(
        routing.points,
        routing.traceWidth,
        routing.layerId,
        netId
      );

      set((state) => {
        if (!state.pcb) return { routing: null, mode: "select" as const };
        return {
          pcb: Pcb.addTrace(state.pcb, trace),
          routing: null,
          mode: "select" as const,
        };
      });

      return trace.id;
    },

    cancelRoute: () => {
      set({
        routing: null,
        mode: "select",
      });
    },

    setRouteWidth: (width) => {
      set((state) => {
        if (!state.routing) return state;
        return {
          routing: { ...state.routing, traceWidth: width },
        };
      });
    },

    switchRouteLayer: () => {
      const { routing, pcb } = get();
      if (!routing || !pcb) return;

      const topLayer = Pcb.getTopCopperLayer(pcb);
      const bottomLayer = Pcb.getBottomCopperLayer(pcb);

      if (!topLayer || !bottomLayer) return;

      const newLayer = routing.layerId === topLayer ? bottomLayer : topLayer;

      set({
        routing: { ...routing, layerId: newLayer },
        activeLayer: newLayer,
      });
    },

    placeViaAndSwitchLayer: () => {
      const { routing, pcb, gridSize, snapToGrid: snap } = get();
      if (!routing || routing.points.length === 0 || !pcb) return null;

      const topLayer = Pcb.getTopCopperLayer(pcb);
      const bottomLayer = Pcb.getBottomCopperLayer(pcb);
      if (!topLayer || !bottomLayer) return null;

      get().pushHistory();

      const lastPoint = routing.points[routing.points.length - 1];
      const snappedPos = snap ? snapToGrid(lastPoint, gridSize) : lastPoint;

      const via = Pcb.createThroughVia(
        snappedPos,
        routing.netId || ("unrouted" as NetId),
        pcb.designRules.minViaDiameter,
        pcb.designRules.minViaDrill,
        topLayer,
        bottomLayer
      );

      const newLayer = routing.layerId === topLayer ? bottomLayer : topLayer;

      set((state) => {
        if (!state.pcb || !state.routing) return state;
        return {
          pcb: Pcb.addVia(state.pcb, via),
          routing: {
            ...state.routing,
            layerId: newLayer,
            points: [snappedPos], // Start new segment from via position
          },
          activeLayer: newLayer,
        };
      });

      return via.id;
    },

    // ========================================
    // Trace operations
    // ========================================

    deleteSelectedTraces: () => {
      const { pcb, selectedTraces } = get();
      if (selectedTraces.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const traceId of selectedTraces) {
        doc = Pcb.deleteTrace(doc, traceId);
      }

      set({
        pcb: doc,
        selectedTraces: new Set(),
      });
    },

    setTraceNet: (traceId, netId) => {
      const { pcb } = get();
      if (!pcb) return;
      const trace = pcb.traces.get(traceId);
      if (!trace) return;

      get().pushHistory();

      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.updateTrace(state.pcb, { ...trace, netId }),
        };
      });
    },

    // ========================================
    // Via operations
    // ========================================

    placeVia: (position, netId) => {
      const { pcb, gridSize, snapToGrid: snap } = get();
      if (!pcb) return null;

      const topLayer = Pcb.getTopCopperLayer(pcb);
      const bottomLayer = Pcb.getBottomCopperLayer(pcb);
      if (!topLayer || !bottomLayer) return null;

      get().pushHistory();

      const snappedPos = snap ? snapToGrid(position, gridSize) : position;

      const via = Pcb.createThroughVia(
        snappedPos,
        netId,
        pcb.designRules.minViaDiameter,
        pcb.designRules.minViaDrill,
        topLayer,
        bottomLayer
      );

      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.addVia(state.pcb, via),
        };
      });

      return via.id;
    },

    deleteSelectedVias: () => {
      const { pcb, selectedVias } = get();
      if (selectedVias.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const viaId of selectedVias) {
        doc = Pcb.deleteVia(doc, viaId);
      }

      set({
        pcb: doc,
        selectedVias: new Set(),
      });
    },

    // ========================================
    // Zone operations
    // ========================================

    startZone: (netId) => {
      set({
        mode: "draw-zone",
        zoneDrawing: {
          netId,
          points: [],
        },
      });
    },

    addZonePoint: (position) => {
      const { zoneDrawing, gridSize, snapToGrid: snap } = get();
      if (!zoneDrawing) return;

      const snappedPos = snap ? snapToGrid(position, gridSize) : position;

      set({
        zoneDrawing: {
          ...zoneDrawing,
          points: [...zoneDrawing.points, snappedPos],
        },
      });
    },

    finishZone: () => {
      const { pcb, zoneDrawing, activeLayer } = get();
      if (!zoneDrawing || zoneDrawing.points.length < 3 || !activeLayer) {
        set({ zoneDrawing: null });
        return null;
      }

      get().pushHistory();

      const pour: CopperPour = {
        id: newId("CopperPour"),
        layerId: activeLayer,
        netId: zoneDrawing.netId || ("" as NetId),
        outline: zoneDrawing.points,
        priority: 0,
        fillType: "solid",
        clearance: 0.2,
        minWidth: 0.2,
        thermalReliefGap: 0.5,
        thermalReliefSpokeWidth: 0.5,
        padConnection: "thermal_relief",
        locked: false,
      };

      set((state) => {
        if (!state.pcb) return { zoneDrawing: null, mode: "select" as const };
        return {
          pcb: Pcb.addCopperPour(state.pcb, pour),
          zoneDrawing: null,
          mode: "select" as const,
        };
      });

      return pour.id;
    },

    cancelZone: () => {
      set({
        zoneDrawing: null,
        mode: "select",
      });
    },

    deleteSelectedZones: () => {
      const { pcb, selectedPours } = get();
      if (selectedPours.size === 0 || !pcb) return;

      get().pushHistory();

      let doc = pcb;
      for (const pourId of selectedPours) {
        doc = Pcb.deleteCopperPour(doc, pourId);
      }

      set({
        pcb: doc,
        selectedPours: new Set(),
      });
    },

    refillAllZones: () => {
      // TODO: Implement zone refill algorithm
      console.log("Zone refill not yet implemented");
    },

    // ========================================
    // Net operations
    // ========================================

    setNetClass: (netId, classId) => {
      const { pcb } = get();
      if (!pcb) return;
      const net = pcb.nets.get(netId);
      if (!net) return;

      get().pushHistory();

      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.setNet(state.pcb, netId, { ...net, classId }),
        };
      });
    },

    // ========================================
    // DRC
    // ========================================

    runDrc: () => {
      set({ drcRunning: true });

      // TODO: Implement actual DRC
      // For now, just clear violations after a delay
      setTimeout(() => {
        set((state) => {
          if (!state.pcb) return { drcRunning: false };
          return {
            pcb: Pcb.setDrcViolations(state.pcb, []),
            drcRunning: false,
          };
        });
      }, 500);
    },

    clearDrc: () => {
      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.setDrcViolations(state.pcb, undefined),
        };
      });
    },

    toggleDrcViolations: () => {
      set((state) => ({ showDrcViolations: !state.showDrcViolations }));
    },

    // ========================================
    // Selection
    // ========================================

    selectInstance: (instanceId, addToSelection = false) => {
      set((state) => {
        const newSelection = addToSelection
          ? new Set(state.selectedInstances)
          : new Set<FootprintInstanceId>();
        newSelection.add(instanceId);
        return {
          selectedInstances: newSelection,
          selectedTraces: addToSelection ? state.selectedTraces : new Set(),
          selectedVias: addToSelection ? state.selectedVias : new Set(),
          selectedPours: addToSelection ? state.selectedPours : new Set(),
        };
      });
    },

    selectTrace: (traceId, addToSelection = false) => {
      set((state) => {
        const newSelection = addToSelection
          ? new Set(state.selectedTraces)
          : new Set<TraceId>();
        newSelection.add(traceId);
        return {
          selectedInstances: addToSelection ? state.selectedInstances : new Set(),
          selectedTraces: newSelection,
          selectedVias: addToSelection ? state.selectedVias : new Set(),
          selectedPours: addToSelection ? state.selectedPours : new Set(),
        };
      });
    },

    selectVia: (viaId, addToSelection = false) => {
      set((state) => {
        const newSelection = addToSelection
          ? new Set(state.selectedVias)
          : new Set<ViaId>();
        newSelection.add(viaId);
        return {
          selectedInstances: addToSelection ? state.selectedInstances : new Set(),
          selectedTraces: addToSelection ? state.selectedTraces : new Set(),
          selectedVias: newSelection,
          selectedPours: addToSelection ? state.selectedPours : new Set(),
        };
      });
    },

    selectPour: (pourId, addToSelection = false) => {
      set((state) => {
        const newSelection = addToSelection
          ? new Set(state.selectedPours)
          : new Set<CopperPourId>();
        newSelection.add(pourId);
        return {
          selectedInstances: addToSelection ? state.selectedInstances : new Set(),
          selectedTraces: addToSelection ? state.selectedTraces : new Set(),
          selectedVias: addToSelection ? state.selectedVias : new Set(),
          selectedPours: newSelection,
        };
      });
    },

    clearSelection: () => {
      set({
        selectedInstances: new Set(),
        selectedTraces: new Set(),
        selectedVias: new Set(),
        selectedPours: new Set(),
      });
    },

    selectAll: () => {
      const { pcb } = get();
      if (!pcb) return;
      set({
        selectedInstances: new Set(pcb.instances.keys()),
        selectedTraces: new Set(pcb.traces.keys()),
        selectedVias: new Set(pcb.vias.keys()),
        selectedPours: new Set(pcb.copperPours.keys()),
      });
    },

    deleteSelection: () => {
      get().deleteSelectedInstances();
      get().deleteSelectedTraces();
      get().deleteSelectedVias();
      get().deleteSelectedZones();
    },

    // ========================================
    // Hover
    // ========================================

    setHoveredInstance: (instanceId) => set({ hoveredInstance: instanceId }),
    setHoveredTrace: (traceId) => set({ hoveredTrace: traceId }),
    setHoveredVia: (viaId) => set({ hoveredVia: viaId }),
    setHoveredPad: (pad) => set({ hoveredPad: pad }),

    // ========================================
    // Grid
    // ========================================

    setGridSize: (size) => set({ gridSize: size }),
    toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

    // ========================================
    // View toggles
    // ========================================

    toggle3dView: () => set((state) => ({ show3dView: !state.show3dView })),
    toggleRatsnest: () => set((state) => ({ showRatsnest: !state.showRatsnest })),

    // ========================================
    // Library browser
    // ========================================

    toggleLibraryBrowser: () => set((state) => ({ libraryBrowserOpen: !state.libraryBrowserOpen })),

    // ========================================
    // Board outline
    // ========================================

    setBoardOutline: (outline) => {
      get().pushHistory();
      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.setBoardOutline(state.pcb, outline),
        };
      });
    },

    // ========================================
    // Design rules
    // ========================================

    setDesignRules: (rules) => {
      get().pushHistory();
      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.setDesignRules(state.pcb, rules),
        };
      });
    },

    // ========================================
    // Linked schematic
    // ========================================

    linkSchematic: (path) => {
      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.setLinkedSchematic(state.pcb, path),
        };
      });
    },

    unlinkSchematic: () => {
      set((state) => {
        if (!state.pcb) return state;
        return {
          pcb: Pcb.setLinkedSchematic(state.pcb, undefined),
        };
      });
    },

    // ========================================
    // Clipboard
    // ========================================

    copySelection: () => {
      // TODO: Implement clipboard
    },

    cutSelection: () => {
      get().copySelection();
      get().deleteSelection();
    },

    paste: (position) => {
      // TODO: Implement paste
    },

    // ========================================
    // Query helpers
    // ========================================

    getFootprint: (footprintId) => get().pcb?.footprints.get(footprintId),
    getInstance: (instanceId) => get().pcb?.instances.get(instanceId),
    getTrace: (traceId) => get().pcb?.traces.get(traceId),
    getVia: (viaId) => get().pcb?.vias.get(viaId),

    getActiveLayerTraces: () => {
      const { pcb, activeLayer } = get();
      if (!activeLayer || !pcb) return [];
      return Array.from(pcb.traces.values()).filter((t) => t.layerId === activeLayer);
    },
  };
});
