/**
 * Schematic Store - state management for schematic editor
 */

import { create } from "zustand";
import type {
  SchematicDocument,
  SheetId,
  SymbolId,
  SymbolInstanceId,
  WireId,
  NetId,
  NetLabelId,
  PinId,
  Symbol,
  SymbolInstance,
  Wire,
  Net,
  NetLabel,
  SchematicPoint,
  NetClass,
  NetClassId,
} from "@vibecad/core";
import {
  createSchematicDocument,
  addSymbolInstance,
  updateSymbolInstance,
  deleteSymbolInstance,
  addWire,
  deleteWire,
  addNet,
  updateNet,
  addNetLabel,
  addSymbol,
  setActiveSheet,
  getActiveSheetInstances,
  getActiveSheetWires,
  getActiveSheetLabels,
  getNextRefDes,
  createSymbolInstance,
  createWire,
  createNet,
  createNetLabel,
  moveInstance,
  rotateInstance,
  mirrorInstance,
  setInstanceRefDes,
  setInstanceValue,
  snapToGrid,
} from "@vibecad/core";
import { HistoryState, createHistory, pushState, undo as historyUndo, redo as historyRedo } from "@vibecad/core";

// ============================================================================
// Types
// ============================================================================

export type SchematicEditorMode =
  | "select" // Select/move components and wires
  | "place-symbol" // Placing a symbol from library
  | "draw-wire" // Drawing wires
  | "draw-bus" // Drawing buses
  | "place-label" // Placing net labels
  | "place-port" // Placing hierarchical ports
  | "annotate"; // Editing ref des / values

export type SchematicTool =
  | "select"
  | "wire"
  | "bus"
  | "net-label"
  | "global-label"
  | "port"
  | "no-connect"
  | "junction"
  | "text"
  | "line"
  | "delete";

// ============================================================================
// State Interface
// ============================================================================

interface SchematicState {
  // Document
  schematic: SchematicDocument;

  // History
  historyState: HistoryState<SchematicDocument>;

  // View state
  viewOffset: { x: number; y: number };
  zoom: number;

  // Editor state
  mode: SchematicEditorMode;
  activeTool: SchematicTool;

  // Selection
  selectedInstances: Set<SymbolInstanceId>;
  selectedWires: Set<WireId>;
  selectedLabels: Set<NetLabelId>;

  // Hover
  hoveredInstance: SymbolInstanceId | null;
  hoveredWire: WireId | null;
  hoveredPin: { instanceId: SymbolInstanceId; pinId: PinId } | null;

  // Mouse position (in schematic coordinates)
  mousePos: SchematicPoint | null;

  // Wire drawing state
  wireDrawing: {
    points: SchematicPoint[];
    startPin?: { instanceId: SymbolInstanceId; pinId: PinId };
  } | null;

  // Symbol placement state
  pendingSymbol: {
    symbolId: SymbolId;
    rotation: 0 | 90 | 180 | 270;
    mirror: boolean;
  } | null;

  // Grid
  gridSize: number;
  snapToGrid: boolean;

  // Library browser state
  libraryBrowserOpen: boolean;
}

// ============================================================================
// Actions Interface
// ============================================================================

interface SchematicActions {
  // Document management
  setSchematic: (doc: SchematicDocument) => void;
  newSchematic: (name: string) => void;

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
  fitView: () => void;
  setMousePos: (pos: SchematicPoint | null) => void;

  // Mode/Tool
  setMode: (mode: SchematicEditorMode) => void;
  setTool: (tool: SchematicTool) => void;

  // Sheet management
  setActiveSheet: (sheetId: SheetId) => void;
  newSheet: () => SheetId;
  deleteSheet: (sheetId: SheetId) => void;

  // Symbol operations
  addSymbolToLibrary: (symbol: Symbol) => void;
  startPlaceSymbol: (symbolId: SymbolId) => void;
  cancelPlaceSymbol: () => void;
  rotatePendingSymbol: () => void;
  mirrorPendingSymbol: () => void;
  placeSymbol: (position: SchematicPoint) => SymbolInstanceId | null;

  // Instance operations
  moveSelectedInstances: (delta: SchematicPoint) => void;
  rotateSelectedInstances: () => void;
  mirrorSelectedInstances: () => void;
  deleteSelectedInstances: () => void;
  setInstanceRefDes: (instanceId: SymbolInstanceId, refDes: string) => void;
  setInstanceValue: (instanceId: SymbolInstanceId, value: string) => void;

  // Wire operations
  startWire: (point: SchematicPoint, startPin?: { instanceId: SymbolInstanceId; pinId: PinId }) => void;
  addWirePoint: (point: SchematicPoint) => void;
  finishWire: (endPin?: { instanceId: SymbolInstanceId; pinId: PinId }) => WireId | null;
  cancelWire: () => void;
  deleteSelectedWires: () => void;

  // Net operations
  renameNet: (netId: NetId, name: string) => void;

  // Label operations
  placeNetLabel: (position: SchematicPoint, netName: string, style: "local" | "global") => NetLabelId | null;
  deleteSelectedLabels: () => void;

  // Selection
  selectInstance: (instanceId: SymbolInstanceId, addToSelection?: boolean) => void;
  selectWire: (wireId: WireId, addToSelection?: boolean) => void;
  selectLabel: (labelId: NetLabelId, addToSelection?: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;
  deleteSelection: () => void;

  // Hover
  setHoveredInstance: (instanceId: SymbolInstanceId | null) => void;
  setHoveredWire: (wireId: WireId | null) => void;
  setHoveredPin: (pin: { instanceId: SymbolInstanceId; pinId: PinId } | null) => void;

  // Grid
  setGridSize: (size: number) => void;
  toggleSnapToGrid: () => void;

  // Library browser
  toggleLibraryBrowser: () => void;

  // Clipboard
  copySelection: () => void;
  cutSelection: () => void;
  paste: (position: SchematicPoint) => void;

  // Query helpers
  getActiveSheetInstances: () => SymbolInstance[];
  getActiveSheetWires: () => Wire[];
  getActiveSheetLabels: () => NetLabel[];
  getSymbol: (symbolId: SymbolId) => Symbol | undefined;
}

// ============================================================================
// Store
// ============================================================================

export const useSchematicStore = create<SchematicState & SchematicActions>()((set, get) => ({
  // Initial state
  schematic: createSchematicDocument("Untitled Schematic"),
  historyState: createHistory(createSchematicDocument("Untitled Schematic")),

  viewOffset: { x: 0, y: 0 },
  zoom: 1,

  mode: "select",
  activeTool: "select",

  selectedInstances: new Set(),
  selectedWires: new Set(),
  selectedLabels: new Set(),

  hoveredInstance: null,
  hoveredWire: null,
  hoveredPin: null,

  mousePos: null,

  wireDrawing: null,
  pendingSymbol: null,

  gridSize: 50, // 50 units (typically mils)
  snapToGrid: true,

  libraryBrowserOpen: false,

  // ========================================
  // Document management
  // ========================================

  setSchematic: (doc) => {
    set({
      schematic: doc,
      historyState: createHistory(doc),
      selectedInstances: new Set(),
      selectedWires: new Set(),
      selectedLabels: new Set(),
      wireDrawing: null,
      pendingSymbol: null,
    });
  },

  newSchematic: (name) => {
    const doc = createSchematicDocument(name);
    set({
      schematic: doc,
      historyState: createHistory(doc),
      selectedInstances: new Set(),
      selectedWires: new Set(),
      selectedLabels: new Set(),
      wireDrawing: null,
      pendingSymbol: null,
      viewOffset: { x: 0, y: 0 },
      zoom: 1,
    });
  },

  // ========================================
  // History
  // ========================================

  pushHistory: () => {
    set((state) => ({
      historyState: pushState(state.historyState, state.schematic),
    }));
  },

  undo: () => {
    const { historyState } = get();
    const result = historyUndo(historyState);
    if (result) {
      set({
        schematic: result.present,
        historyState: result,
        selectedInstances: new Set(),
        selectedWires: new Set(),
        selectedLabels: new Set(),
      });
    }
  },

  redo: () => {
    const { historyState } = get();
    const result = historyRedo(historyState);
    if (result) {
      set({
        schematic: result.present,
        historyState: result,
        selectedInstances: new Set(),
        selectedWires: new Set(),
        selectedLabels: new Set(),
      });
    }
  },

  canUndo: () => get().historyState.past.length > 0,
  canRedo: () => get().historyState.future.length > 0,

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

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),

  zoomIn: () => set((state) => ({ zoom: Math.min(10, state.zoom * 1.2) })),

  zoomOut: () => set((state) => ({ zoom: Math.max(0.1, state.zoom / 1.2) })),

  fitView: () => {
    // TODO: Calculate bounds and fit
    set({ viewOffset: { x: 0, y: 0 }, zoom: 1 });
  },

  setMousePos: (pos) => set({ mousePos: pos }),

  // ========================================
  // Mode/Tool
  // ========================================

  setMode: (mode) => {
    set({
      mode,
      wireDrawing: null,
      pendingSymbol: null,
    });
  },

  setTool: (tool) => {
    let mode: SchematicEditorMode = "select";
    if (tool === "wire" || tool === "bus") {
      mode = "draw-wire";
    } else if (tool === "net-label" || tool === "global-label") {
      mode = "place-label";
    }
    set({
      activeTool: tool,
      mode,
      wireDrawing: null,
    });
  },

  // ========================================
  // Sheet management
  // ========================================

  setActiveSheet: (sheetId) => {
    set((state) => ({
      schematic: setActiveSheet(state.schematic, sheetId),
      selectedInstances: new Set(),
      selectedWires: new Set(),
      selectedLabels: new Set(),
    }));
  },

  newSheet: () => {
    // TODO: Implement
    return "" as SheetId;
  },

  deleteSheet: (sheetId) => {
    // TODO: Implement
  },

  // ========================================
  // Symbol operations
  // ========================================

  addSymbolToLibrary: (symbol) => {
    set((state) => ({
      schematic: addSymbol(state.schematic, symbol),
    }));
  },

  startPlaceSymbol: (symbolId) => {
    set({
      mode: "place-symbol",
      pendingSymbol: {
        symbolId,
        rotation: 0,
        mirror: false,
      },
    });
  },

  cancelPlaceSymbol: () => {
    set({
      mode: "select",
      pendingSymbol: null,
    });
  },

  rotatePendingSymbol: () => {
    set((state) => {
      if (!state.pendingSymbol) return state;
      const newRotation = ((state.pendingSymbol.rotation + 90) % 360) as 0 | 90 | 180 | 270;
      return {
        pendingSymbol: { ...state.pendingSymbol, rotation: newRotation },
      };
    });
  },

  mirrorPendingSymbol: () => {
    set((state) => {
      if (!state.pendingSymbol) return state;
      return {
        pendingSymbol: { ...state.pendingSymbol, mirror: !state.pendingSymbol.mirror },
      };
    });
  },

  placeSymbol: (position) => {
    const { schematic, pendingSymbol, gridSize, snapToGrid: snap } = get();
    if (!pendingSymbol) return null;

    const symbol = schematic.symbols.get(pendingSymbol.symbolId);
    if (!symbol) return null;

    get().pushHistory();

    const snappedPos = snap ? snapToGrid(position, gridSize) : position;
    const refDes = getNextRefDes(schematic, symbol.refDesPrefix);

    const instance = createSymbolInstance(
      pendingSymbol.symbolId,
      snappedPos,
      schematic.activeSheetId,
      refDes
    );

    // Apply rotation and mirror
    let finalInstance = instance;
    finalInstance = { ...finalInstance, rotation: pendingSymbol.rotation, mirror: pendingSymbol.mirror };

    set((state) => ({
      schematic: addSymbolInstance(state.schematic, finalInstance),
    }));

    return instance.id;
  },

  // ========================================
  // Instance operations
  // ========================================

  moveSelectedInstances: (delta) => {
    const { schematic, selectedInstances, gridSize, snapToGrid: snap } = get();
    if (selectedInstances.size === 0) return;

    get().pushHistory();

    let doc = schematic;
    for (const instanceId of selectedInstances) {
      const instance = doc.symbolInstances.get(instanceId);
      if (instance) {
        const newPos = {
          x: instance.position.x + delta.x,
          y: instance.position.y + delta.y,
        };
        const snappedPos = snap ? snapToGrid(newPos, gridSize) : newPos;
        doc = updateSymbolInstance(doc, moveInstance(instance, snappedPos));
      }
    }

    set({ schematic: doc });
  },

  rotateSelectedInstances: () => {
    const { schematic, selectedInstances } = get();
    if (selectedInstances.size === 0) return;

    get().pushHistory();

    let doc = schematic;
    for (const instanceId of selectedInstances) {
      const instance = doc.symbolInstances.get(instanceId);
      if (instance) {
        doc = updateSymbolInstance(doc, rotateInstance(instance));
      }
    }

    set({ schematic: doc });
  },

  mirrorSelectedInstances: () => {
    const { schematic, selectedInstances } = get();
    if (selectedInstances.size === 0) return;

    get().pushHistory();

    let doc = schematic;
    for (const instanceId of selectedInstances) {
      const instance = doc.symbolInstances.get(instanceId);
      if (instance) {
        doc = updateSymbolInstance(doc, mirrorInstance(instance));
      }
    }

    set({ schematic: doc });
  },

  deleteSelectedInstances: () => {
    const { schematic, selectedInstances } = get();
    if (selectedInstances.size === 0) return;

    get().pushHistory();

    let doc = schematic;
    for (const instanceId of selectedInstances) {
      doc = deleteSymbolInstance(doc, instanceId);
    }

    set({
      schematic: doc,
      selectedInstances: new Set(),
    });
  },

  setInstanceRefDes: (instanceId, refDes) => {
    const { schematic } = get();
    const instance = schematic.symbolInstances.get(instanceId);
    if (!instance) return;

    get().pushHistory();

    set((state) => ({
      schematic: updateSymbolInstance(state.schematic, setInstanceRefDes(instance, refDes)),
    }));
  },

  setInstanceValue: (instanceId, value) => {
    const { schematic } = get();
    const instance = schematic.symbolInstances.get(instanceId);
    if (!instance) return;

    get().pushHistory();

    set((state) => ({
      schematic: updateSymbolInstance(state.schematic, setInstanceValue(instance, value)),
    }));
  },

  // ========================================
  // Wire operations
  // ========================================

  startWire: (point, startPin) => {
    const { gridSize, snapToGrid: snap } = get();
    const snappedPoint = snap ? snapToGrid(point, gridSize) : point;

    set({
      mode: "draw-wire",
      wireDrawing: {
        points: [snappedPoint],
        startPin,
      },
    });
  },

  addWirePoint: (point) => {
    const { wireDrawing, gridSize, snapToGrid: snap } = get();
    if (!wireDrawing) return;

    const snappedPoint = snap ? snapToGrid(point, gridSize) : point;

    // Add intermediate orthogonal point if needed
    const lastPoint = wireDrawing.points[wireDrawing.points.length - 1];
    const newPoints = [...wireDrawing.points];

    // Create orthogonal routing (horizontal then vertical)
    if (lastPoint.x !== snappedPoint.x && lastPoint.y !== snappedPoint.y) {
      // Add corner point
      newPoints.push({ x: snappedPoint.x, y: lastPoint.y });
    }
    newPoints.push(snappedPoint);

    set({
      wireDrawing: { ...wireDrawing, points: newPoints },
    });
  },

  finishWire: (endPin) => {
    const { schematic, wireDrawing } = get();
    if (!wireDrawing || wireDrawing.points.length < 2) {
      set({ wireDrawing: null });
      return null;
    }

    get().pushHistory();

    // Create or find net
    let netId: NetId;
    let doc = schematic;

    // Check if we're connecting to existing nets
    // For now, create a new net
    const net = createNet(`Net_${doc.nets.size + 1}`);
    doc = addNet(doc, net);
    netId = net.id;

    // Create wire
    const wire = createWire(wireDrawing.points, netId, doc.activeSheetId);
    doc = addWire(doc, wire);

    // Update net with wire
    const updatedNet = { ...doc.nets.get(netId)!, wires: [...doc.nets.get(netId)!.wires, wire.id] };
    doc = updateNet(doc, updatedNet);

    set({
      schematic: doc,
      wireDrawing: null,
      mode: "select",
    });

    return wire.id;
  },

  cancelWire: () => {
    set({
      wireDrawing: null,
      mode: "select",
    });
  },

  deleteSelectedWires: () => {
    const { schematic, selectedWires } = get();
    if (selectedWires.size === 0) return;

    get().pushHistory();

    let doc = schematic;
    for (const wireId of selectedWires) {
      doc = deleteWire(doc, wireId);
    }

    set({
      schematic: doc,
      selectedWires: new Set(),
    });
  },

  // ========================================
  // Net operations
  // ========================================

  renameNet: (netId, name) => {
    const { schematic } = get();
    const net = schematic.nets.get(netId);
    if (!net) return;

    get().pushHistory();

    set((state) => ({
      schematic: updateNet(state.schematic, { ...net, name }),
    }));
  },

  // ========================================
  // Label operations
  // ========================================

  placeNetLabel: (position, netName, style) => {
    const { schematic, gridSize, snapToGrid: snap } = get();

    get().pushHistory();

    const snappedPos = snap ? snapToGrid(position, gridSize) : position;
    const label = createNetLabel(snappedPos, netName, style, schematic.activeSheetId);

    set((state) => ({
      schematic: addNetLabel(state.schematic, label),
    }));

    return label.id;
  },

  deleteSelectedLabels: () => {
    // TODO: Implement
  },

  // ========================================
  // Selection
  // ========================================

  selectInstance: (instanceId, addToSelection = false) => {
    set((state) => {
      const newSelection = addToSelection
        ? new Set(state.selectedInstances)
        : new Set<SymbolInstanceId>();
      newSelection.add(instanceId);
      return {
        selectedInstances: newSelection,
        selectedWires: addToSelection ? state.selectedWires : new Set(),
        selectedLabels: addToSelection ? state.selectedLabels : new Set(),
      };
    });
  },

  selectWire: (wireId, addToSelection = false) => {
    set((state) => {
      const newSelection = addToSelection
        ? new Set(state.selectedWires)
        : new Set<WireId>();
      newSelection.add(wireId);
      return {
        selectedInstances: addToSelection ? state.selectedInstances : new Set(),
        selectedWires: newSelection,
        selectedLabels: addToSelection ? state.selectedLabels : new Set(),
      };
    });
  },

  selectLabel: (labelId, addToSelection = false) => {
    set((state) => {
      const newSelection = addToSelection
        ? new Set(state.selectedLabels)
        : new Set<NetLabelId>();
      newSelection.add(labelId);
      return {
        selectedInstances: addToSelection ? state.selectedInstances : new Set(),
        selectedWires: addToSelection ? state.selectedWires : new Set(),
        selectedLabels: newSelection,
      };
    });
  },

  clearSelection: () => {
    set({
      selectedInstances: new Set(),
      selectedWires: new Set(),
      selectedLabels: new Set(),
    });
  },

  selectAll: () => {
    const { schematic } = get();
    const sheet = schematic.sheets.get(schematic.activeSheetId);
    if (!sheet) return;

    set({
      selectedInstances: new Set(sheet.symbolInstances),
      selectedWires: new Set(sheet.wires),
      selectedLabels: new Set(sheet.labels),
    });
  },

  deleteSelection: () => {
    get().deleteSelectedInstances();
    get().deleteSelectedWires();
    get().deleteSelectedLabels();
  },

  // ========================================
  // Hover
  // ========================================

  setHoveredInstance: (instanceId) => set({ hoveredInstance: instanceId }),
  setHoveredWire: (wireId) => set({ hoveredWire: wireId }),
  setHoveredPin: (pin) => set({ hoveredPin: pin }),

  // ========================================
  // Grid
  // ========================================

  setGridSize: (size) => set({ gridSize: size }),
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

  // ========================================
  // Library browser
  // ========================================

  toggleLibraryBrowser: () => set((state) => ({ libraryBrowserOpen: !state.libraryBrowserOpen })),

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

  getActiveSheetInstances: () => getActiveSheetInstances(get().schematic),
  getActiveSheetWires: () => getActiveSheetWires(get().schematic),
  getActiveSheetLabels: () => getActiveSheetLabels(get().schematic),
  getSymbol: (symbolId) => get().schematic.symbols.get(symbolId),
}));
