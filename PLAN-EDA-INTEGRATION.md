# vibeCAD EDA Integration Plan

## Executive Summary

This document outlines a comprehensive plan to add Electronic Design Automation (EDA) capabilities to vibeCAD, including:
- **Schematic Editor** (`.vibecad.sch`) - Symbol-based circuit design with nets and electrical rules
- **PCB Editor** (`.vibecad.pcb`) - Physical layout with copper layers, footprints, DRC, and 3D integration

The design follows vibeCAD's existing patterns while introducing EDA-specific abstractions.

---

## Part 1: Architecture Overview

### 1.1 File Type Philosophy

Following vibeCAD's "1 file = 1 operation graph = 1 tab" model:

```
.vibecad      → 3D CAD document (existing)
.vibecad.sch  → Schematic document (new)
.vibecad.pcb  → PCB layout document (new)
```

Each file type:
- Opens in its own tab with specialized editor
- Has its own operation graph and evaluation pipeline
- Can reference other vibeCAD files (cross-document links)

### 1.2 Cross-Document Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Relationships                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   .vibecad.sch ──────────────────────────► .vibecad.pcb         │
│       │         (netlist export)               │                │
│       │                                        │                │
│       │                                        ▼                │
│       │                                   .vibecad              │
│       │                              (3D board model +          │
│       │                               component bodies)         │
│       │                                        ▲                │
│       └────────────────────────────────────────┘                │
│            (profile import from CAD for board outline)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Integration Points:**
1. **Schematic → PCB**: Netlist sync, component placement requirements
2. **CAD → PCB**: Import board outline profile from `.vibecad` sketch
3. **PCB → CAD**: Generate 3D PCB model with component bodies for enclosure design

---

## Part 2: Type System Extensions

### 2.1 New Branded ID Types

```typescript
// packages/core/src/types/id.ts - additions

// Schematic IDs
export type SchematicId = Id<"Schematic">;
export type SymbolId = Id<"Symbol">;
export type SymbolInstanceId = Id<"SymbolInstance">;
export type NetId = Id<"Net">;
export type PinId = Id<"Pin">;
export type WireId = Id<"Wire">;
export type BusId = Id<"Bus">;
export type SheetId = Id<"Sheet">;
export type PortId = Id<"Port">;
export type NetLabelId = Id<"NetLabel">;

// PCB IDs
export type PcbId = Id<"Pcb">;
export type FootprintId = Id<"Footprint">;
export type FootprintInstanceId = Id<"FootprintInstance">;
export type PadId = Id<"Pad">;
export type TraceId = Id<"Trace">;
export type ViaId = Id<"Via">;
export type CopperPourId = Id<"CopperPour">;
export type LayerId = Id<"Layer">;
export type DrillId = Id<"Drill">;
export type ZoneId = Id<"Zone">;
export type KeepoutId = Id<"Keepout">;

// Component Library IDs
export type ComponentId = Id<"Component">;
export type ComponentLibraryId = Id<"ComponentLibrary">;
export type Model3dRefId = Id<"Model3dRef">;
```

### 2.2 Schematic Types

```typescript
// packages/core/src/types/schematic/

// === Base Types ===

export interface SchematicPoint {
  x: number;  // Grid units (typically 100mil grid)
  y: number;
}

// === Symbols ===

export interface SymbolPin {
  id: PinId;
  name: string;
  number: string;  // Pin number (can be alphanumeric)
  position: SchematicPoint;  // Relative to symbol origin
  orientation: "left" | "right" | "up" | "down";
  type: PinType;
  shape: PinShape;
  hidden: boolean;
}

export type PinType =
  | "input"
  | "output"
  | "bidirectional"
  | "tristate"
  | "passive"
  | "power_in"
  | "power_out"
  | "open_collector"
  | "open_emitter"
  | "not_connected";

export type PinShape =
  | "line"
  | "inverted"
  | "clock"
  | "inverted_clock"
  | "input_low"
  | "output_low"
  | "edge_clock_high"
  | "non_logic";

export interface Symbol {
  id: SymbolId;
  name: string;
  description: string;

  // Graphics
  primitives: SymbolPrimitive[];  // Lines, rects, circles, arcs, text
  pins: Map<PinId, SymbolPin>;

  // Bounding box (computed)
  bounds: { minX: number; minY: number; maxX: number; maxY: number };

  // Reference designator prefix (e.g., "R" for resistors)
  refDesPrefix: string;

  // Library reference
  libraryId?: ComponentLibraryId;
  componentId?: ComponentId;
}

export type SymbolPrimitive =
  | { type: "line"; start: SchematicPoint; end: SchematicPoint; width: number }
  | { type: "rect"; corner1: SchematicPoint; corner2: SchematicPoint; fill: boolean }
  | { type: "circle"; center: SchematicPoint; radius: number; fill: boolean }
  | { type: "arc"; center: SchematicPoint; radius: number; startAngle: number; endAngle: number }
  | { type: "polyline"; points: SchematicPoint[]; width: number; fill: boolean }
  | { type: "text"; position: SchematicPoint; text: string; fontSize: number; justify: TextJustify };

// === Symbol Instances ===

export interface SymbolInstance {
  id: SymbolInstanceId;
  symbolId: SymbolId;

  // Placement
  position: SchematicPoint;
  rotation: 0 | 90 | 180 | 270;
  mirror: boolean;

  // Annotation
  refDes: string;  // e.g., "R1", "U3"
  value: string;   // e.g., "10k", "LM7805"

  // Properties (component-specific)
  properties: Map<string, string>;

  // Which sheet this instance is on
  sheetId: SheetId;
}

// === Wires and Nets ===

export interface Wire {
  id: WireId;
  points: SchematicPoint[];  // Orthogonal segments
  netId: NetId;
  sheetId: SheetId;
}

export interface Junction {
  id: string;
  position: SchematicPoint;
  netId: NetId;
  sheetId: SheetId;
}

export interface Net {
  id: NetId;
  name: string;
  class?: NetClassId;  // For grouping (power, signal, etc.)

  // All connected elements
  wires: WireId[];
  pinConnections: Array<{ instanceId: SymbolInstanceId; pinId: PinId }>;
  labels: NetLabelId[];
  ports: PortId[];
}

export interface NetLabel {
  id: NetLabelId;
  position: SchematicPoint;
  netName: string;
  style: "local" | "global" | "hierarchical";
  sheetId: SheetId;
}

// === Hierarchical Design ===

export interface Sheet {
  id: SheetId;
  name: string;
  number: number;

  // Content references
  symbolInstances: Set<SymbolInstanceId>;
  wires: Set<WireId>;
  labels: Set<NetLabelId>;
  ports: Set<PortId>;

  // Sheet symbol (for hierarchical reference)
  sheetSymbol?: {
    position: SchematicPoint;
    size: { width: number; height: number };
    pins: Array<{ name: string; position: SchematicPoint; netId: NetId }>;
  };
}

export interface Port {
  id: PortId;
  name: string;
  direction: "input" | "output" | "bidirectional";
  position: SchematicPoint;
  sheetId: SheetId;
  netId: NetId;
}

// === Net Classes ===

export type NetClassId = Id<"NetClass">;

export interface NetClass {
  id: NetClassId;
  name: string;

  // Default routing rules (passed to PCB)
  traceWidth: number;
  clearance: number;
  viaSize: number;
  viaDrill: number;

  // DRC rules
  maxLength?: number;
  diffPair?: boolean;
  diffPairGap?: number;
}

// === Top-Level Schematic Document ===

export interface SchematicDocument {
  id: SchematicId;
  name: string;

  // Multi-sheet support
  sheets: Map<SheetId, Sheet>;
  activeSheetId: SheetId;

  // Symbols (instances reference these)
  symbols: Map<SymbolId, Symbol>;
  symbolInstances: Map<SymbolInstanceId, SymbolInstance>;

  // Connectivity
  nets: Map<NetId, Net>;
  wires: Map<WireId, Wire>;
  junctions: Junction[];
  netLabels: Map<NetLabelId, NetLabel>;
  ports: Map<PortId, Port>;

  // Electrical rules
  netClasses: Map<NetClassId, NetClass>;

  // Library references
  libraries: ComponentLibraryId[];

  // Linked PCB (optional)
  linkedPcbPath?: string;

  // Metadata
  meta: {
    createdAt: number;
    modifiedAt: number;
    version: number;
    title?: string;
    revision?: string;
    author?: string;
  };
}
```

### 2.3 PCB Types

```typescript
// packages/core/src/types/pcb/

// === Layer System ===

export type CopperLayerType = "signal" | "plane" | "mixed";
export type LayerType = "copper" | "silkscreen" | "soldermask" | "solderpaste" | "mechanical" | "keepout" | "courtyard";

export interface Layer {
  id: LayerId;
  name: string;
  type: LayerType;

  // For copper layers
  copperType?: CopperLayerType;
  stackPosition?: number;  // 0 = top, N = bottom

  // Visibility
  visible: boolean;
  color: string;  // Hex color for rendering
}

export interface LayerStack {
  layers: LayerId[];  // Ordered from top to bottom
  copperLayers: LayerId[];
  totalThickness: number;  // mm
}

// === Footprints ===

export interface Pad {
  id: PadId;
  number: string;  // Pad number (matches schematic pin)

  // Geometry
  position: Vec2;  // Relative to footprint origin
  rotation: number;

  // Shape
  shape: PadShape;
  size: Vec2;

  // Drill (for through-hole)
  drill?: {
    diameter: number;
    shape: "circular" | "oval";
    offset?: Vec2;
  };

  // Layers
  layers: LayerId[];  // Which copper layers this pad is on

  // Electrical
  netId?: NetId;

  // Thermal relief
  thermalRelief?: {
    gap: number;
    spokeWidth: number;
    spokeCount: number;
  };
}

export type PadShape =
  | { type: "circle"; diameter: number }
  | { type: "rect"; width: number; height: number; cornerRadius?: number }
  | { type: "oval"; width: number; height: number }
  | { type: "trapezoid"; width1: number; width2: number; height: number }
  | { type: "custom"; polygon: Vec2[] };

export interface Footprint {
  id: FootprintId;
  name: string;
  description: string;

  // Pads
  pads: Map<PadId, Pad>;

  // Graphics per layer
  graphics: Map<LayerId, FootprintGraphic[]>;

  // Courtyard (placement boundary)
  courtyard: Vec2[];  // Polygon

  // 3D model reference
  model3d?: {
    path: string;  // Relative path to .vibecad or .step file
    offset: Vec3;
    rotation: Vec3;  // Euler angles in degrees
    scale: Vec3;
  };

  // Library reference
  libraryId?: ComponentLibraryId;
  componentId?: ComponentId;
}

export type FootprintGraphic =
  | { type: "line"; start: Vec2; end: Vec2; width: number }
  | { type: "rect"; corner1: Vec2; corner2: Vec2; fill: boolean; width: number }
  | { type: "circle"; center: Vec2; radius: number; fill: boolean; width: number }
  | { type: "arc"; center: Vec2; radius: number; startAngle: number; endAngle: number; width: number }
  | { type: "polygon"; points: Vec2[]; fill: boolean; width: number }
  | { type: "text"; position: Vec2; text: string; fontSize: number; justify: TextJustify };

// === Footprint Instances ===

export interface FootprintInstance {
  id: FootprintInstanceId;
  footprintId: FootprintId;

  // Placement
  position: Vec2;
  rotation: number;  // Degrees
  side: "top" | "bottom";
  locked: boolean;

  // From schematic
  refDes: string;
  value: string;
  symbolInstanceId?: SymbolInstanceId;  // Link back to schematic

  // Pad net assignments
  padNets: Map<PadId, NetId>;

  // Properties
  properties: Map<string, string>;
}

// === Traces ===

export interface TraceSegment {
  start: Vec2;
  end: Vec2;
  width: number;
}

export interface Trace {
  id: TraceId;
  netId: NetId;
  layerId: LayerId;

  segments: TraceSegment[];

  // Arc segments (optional)
  arcs?: Array<{
    center: Vec2;
    radius: number;
    startAngle: number;
    endAngle: number;
    width: number;
  }>;
}

// === Vias ===

export interface Via {
  id: ViaId;
  position: Vec2;
  netId: NetId;

  // Size
  diameter: number;
  drillDiameter: number;

  // Layer span
  startLayer: LayerId;
  endLayer: LayerId;  // Same as start for through-hole

  // Type
  type: "through" | "blind" | "buried" | "microvia";
}

// === Copper Pours / Zones ===

export interface CopperPour {
  id: CopperPourId;
  layerId: LayerId;
  netId?: NetId;  // undefined = keepout

  // Boundary
  outline: Vec2[];  // Closed polygon

  // Fill settings
  fillType: "solid" | "hatched" | "none";
  hatchAngle?: number;
  hatchGap?: number;
  hatchWidth?: number;

  // Clearance
  clearance: number;
  minWidth: number;

  // Thermal settings
  thermalReliefGap: number;
  thermalReliefSpokeWidth: number;

  // Priority (higher = poured first)
  priority: number;

  // Generated fill (computed)
  fillPolygons?: Vec2[][];
}

// === Board Outline ===

export interface BoardOutline {
  // Main outline (closed polygon)
  outline: Vec2[];

  // Cutouts/holes
  cutouts: Vec2[][];

  // Source reference (if imported from CAD)
  sourceRef?: {
    path: string;  // Relative path to .vibecad file
    sketchId: SketchId;
    profileIndex: number;
  };
}

// === DRC Rules ===

export interface DesignRules {
  // Global minimums
  minTraceWidth: number;
  minTraceClearance: number;
  minViaDiameter: number;
  minViaDrill: number;
  minHoleDiameter: number;
  minAnnularRing: number;
  minSilkscreenWidth: number;

  // Layer-specific rules
  layerRules: Map<LayerId, {
    minTraceWidth?: number;
    minClearance?: number;
  }>;

  // Net class rules (override defaults)
  netClassRules: Map<NetClassId, {
    traceWidth: number;
    clearance: number;
    viaSize: number;
    viaDrill: number;
  }>;

  // Net-specific rules (highest priority)
  netRules: Map<NetId, {
    traceWidth?: number;
    clearance?: number;
  }>;
}

// === DRC Violations ===

export interface DrcViolation {
  id: string;
  type: DrcViolationType;
  severity: "error" | "warning";
  message: string;
  location: Vec2;

  // Affected elements
  elements: Array<{
    type: "trace" | "via" | "pad" | "pour" | "footprint";
    id: string;
  }>;
}

export type DrcViolationType =
  | "clearance"
  | "short"
  | "unconnected"
  | "trace_width"
  | "annular_ring"
  | "drill_size"
  | "copper_pour"
  | "silkscreen"
  | "courtyard_overlap";

// === Top-Level PCB Document ===

export interface PcbDocument {
  id: PcbId;
  name: string;

  // Board
  boardOutline: BoardOutline;
  layerStack: LayerStack;
  layers: Map<LayerId, Layer>;

  // Components
  footprints: Map<FootprintId, Footprint>;
  instances: Map<FootprintInstanceId, FootprintInstance>;

  // Routing
  traces: Map<TraceId, Trace>;
  vias: Map<ViaId, Via>;

  // Copper pours
  copperPours: Map<CopperPourId, CopperPour>;

  // Nets (synced from schematic)
  nets: Map<NetId, {
    name: string;
    classId?: NetClassId;
    pads: Array<{ instanceId: FootprintInstanceId; padId: PadId }>;
    ratsnest?: Array<{ from: Vec2; to: Vec2 }>;
  }>;

  // Design rules
  designRules: DesignRules;
  netClasses: Map<NetClassId, NetClass>;

  // DRC results (computed)
  drcViolations?: DrcViolation[];

  // Linked schematic
  linkedSchematicPath?: string;

  // Units (mm or mils)
  units: "mm" | "mils";

  // Grid settings
  grid: {
    visible: boolean;
    spacing: number;
    snap: boolean;
  };

  // Metadata
  meta: {
    createdAt: number;
    modifiedAt: number;
    version: number;
    boardThickness: number;  // mm
    copperWeight: number;  // oz/ft^2
    finishType: "HASL" | "ENIG" | "OSP" | "immersion_tin" | "immersion_silver";
  };
}
```

---

## Part 3: Component Library System

### 3.1 Library Architecture

```typescript
// packages/core/src/types/library/

export interface Component {
  id: ComponentId;

  // Identity
  name: string;
  description: string;
  keywords: string[];

  // Classification
  category: ComponentCategory;
  subcategory?: string;

  // Symbols (can have multiple for multi-unit parts)
  symbols: SymbolId[];
  symbolUnits?: number;  // e.g., quad op-amp = 4 units

  // Footprints (compatible options)
  footprints: FootprintId[];
  defaultFootprintId?: FootprintId;

  // 3D models
  models3d: Model3dRef[];

  // Electrical specs
  specs: Map<string, string | number>;

  // Supplier/ordering info
  suppliers: SupplierInfo[];

  // Datasheet
  datasheetUrl?: string;

  // Library membership
  libraryId: ComponentLibraryId;
}

export interface Model3dRef {
  id: Model3dRefId;
  name: string;

  // Source
  source:
    | { type: "vibecad"; path: string }  // Relative path to .vibecad file
    | { type: "step"; path: string }     // STEP file
    | { type: "embedded"; data: string }; // Base64 encoded

  // Placement offset relative to footprint
  offset: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface SupplierInfo {
  supplier: string;  // "DigiKey", "Mouser", "LCSC", etc.
  partNumber: string;
  url?: string;
  price?: { quantity: number; price: number }[];
  stock?: number;
  leadTime?: string;
}

export type ComponentCategory =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "diode"
  | "transistor"
  | "ic"
  | "connector"
  | "switch"
  | "relay"
  | "crystal"
  | "transformer"
  | "fuse"
  | "led"
  | "display"
  | "sensor"
  | "module"
  | "mechanical"
  | "other";

export interface ComponentLibrary {
  id: ComponentLibraryId;
  name: string;
  version: string;

  // Contents
  symbols: Map<SymbolId, Symbol>;
  footprints: Map<FootprintId, Footprint>;
  components: Map<ComponentId, Component>;
  models3d: Map<Model3dRefId, Model3dRef>;

  // Source
  source: "builtin" | "user" | "community" | "kicad" | "altium";

  // Metadata
  meta: {
    author?: string;
    license?: string;
    url?: string;
    description?: string;
  };
}
```

### 3.2 Library Integration Sources

The library system should support importing from:

1. **Built-in Libraries**
   - Basic passives (resistors, capacitors, inductors)
   - Common ICs (555, LM7805, ATmega328, etc.)
   - Standard connectors

2. **KiCad Libraries** (Import)
   - Parse `.kicad_sym` for symbols
   - Parse `.kicad_mod` for footprints
   - Map to internal format

3. **SnapEDA / Ultra Librarian / SamacSys**
   - API integration for component search
   - Download symbols, footprints, 3D models

4. **LCSC / JLCPCB Parts**
   - Direct integration with LCSC component database
   - Auto-fetch footprints and 3D models
   - Assembly service compatibility

5. **User Libraries**
   - Create custom components
   - Share via export/import

### 3.3 3D Model Pipeline

```
Component Footprint
        │
        ▼
   Model3dRef
        │
        ├── .vibecad file → Load and transform
        │
        ├── .step file → Import via OpenCascade.js
        │
        └── embedded → Decode and load
        │
        ▼
   Three.js Mesh (for viewport)
        │
        ▼
   Merge with PCB 3D model
        │
        ▼
   Export to .vibecad assembly
```

---

## Part 4: Store Architecture

### 4.1 New Store Files

```
app/web/src/store/
├── cad-store.ts          # Existing - 3D CAD
├── schematic-store.ts    # New - Schematic editor state
├── pcb-store.ts          # New - PCB editor state
├── library-store.ts      # New - Component library management
├── tabs-store.ts         # Existing - Extend for new doc types
├── settings-store.ts     # Existing - Add EDA settings
└── project-store.ts      # Existing - Extend serialization
```

### 4.2 Schematic Store

```typescript
// app/web/src/store/schematic-store.ts

import { create } from "zustand";
import type { SchematicDocument, SheetId, SymbolInstanceId, WireId, NetId, ... } from "@vibecad/core";

export type SchematicEditorMode =
  | "select"           // Select/move components and wires
  | "place-symbol"     // Placing a symbol from library
  | "draw-wire"        // Drawing wires
  | "draw-bus"         // Drawing buses
  | "place-label"      // Placing net labels
  | "place-port"       // Placing hierarchical ports
  | "annotate";        // Editing ref des / values

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

interface SchematicState {
  // Document
  schematic: SchematicDocument;

  // View state
  activeSheetId: SheetId;
  viewOffset: Vec2;
  zoom: number;

  // Editor state
  mode: SchematicEditorMode;
  activeTool: SchematicTool;

  // Selection
  selectedInstances: Set<SymbolInstanceId>;
  selectedWires: Set<WireId>;
  selectedLabels: Set<NetLabelId>;
  selectedNets: Set<NetId>;  // For highlighting connected nets

  // Hover
  hoveredInstance: SymbolInstanceId | null;
  hoveredWire: WireId | null;
  hoveredPin: { instanceId: SymbolInstanceId; pinId: PinId } | null;

  // Drawing state
  wireDrawing: {
    points: SchematicPoint[];
    startPin?: { instanceId: SymbolInstanceId; pinId: PinId };
  } | null;

  // Symbol placement
  pendingSymbol: {
    symbolId: SymbolId;
    position: SchematicPoint;
    rotation: 0 | 90 | 180 | 270;
    mirror: boolean;
  } | null;

  // Grid
  gridSize: number;  // Typically 50 or 100 mils
  snapToGrid: boolean;

  // Library browser
  libraryBrowserOpen: boolean;
  selectedLibrary: ComponentLibraryId | null;

  // ERC (Electrical Rule Check) results
  ercViolations: ErcViolation[];

  // History
  historyState: HistoryState<SchematicDocument>;
}

interface SchematicActions {
  // Document
  setSchematic: (doc: SchematicDocument) => void;
  newSheet: () => SheetId;
  deleteSheet: (sheetId: SheetId) => void;
  setActiveSheet: (sheetId: SheetId) => void;

  // View
  pan: (delta: Vec2) => void;
  setZoom: (zoom: number) => void;
  fitView: () => void;

  // Mode/Tool
  setMode: (mode: SchematicEditorMode) => void;
  setTool: (tool: SchematicTool) => void;

  // Symbol operations
  placeSymbol: (symbolId: SymbolId, position: SchematicPoint) => SymbolInstanceId;
  moveInstance: (instanceId: SymbolInstanceId, position: SchematicPoint) => void;
  rotateInstance: (instanceId: SymbolInstanceId) => void;
  mirrorInstance: (instanceId: SymbolInstanceId) => void;
  deleteInstance: (instanceId: SymbolInstanceId) => void;
  setRefDes: (instanceId: SymbolInstanceId, refDes: string) => void;
  setValue: (instanceId: SymbolInstanceId, value: string) => void;

  // Wire operations
  startWire: (point: SchematicPoint) => void;
  addWirePoint: (point: SchematicPoint) => void;
  finishWire: () => WireId | null;
  cancelWire: () => void;
  deleteWire: (wireId: WireId) => void;

  // Net operations
  renameNet: (netId: NetId, name: string) => void;
  setNetClass: (netId: NetId, classId: NetClassId) => void;

  // Labels
  placeNetLabel: (position: SchematicPoint, netName: string, style: "local" | "global") => NetLabelId;

  // Selection
  select: (ids: { instances?: SymbolInstanceId[]; wires?: WireId[]; labels?: NetLabelId[] }) => void;
  clearSelection: () => void;
  selectAll: () => void;
  selectNet: (netId: NetId) => void;

  // Copy/paste
  copy: () => void;
  cut: () => void;
  paste: (position: SchematicPoint) => void;

  // Annotation
  autoAnnotate: () => void;  // Auto-assign ref des

  // ERC
  runErc: () => void;
  clearErc: () => void;

  // Netlist
  generateNetlist: () => Netlist;
  syncToPcb: (pcbPath: string) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}
```

### 4.3 PCB Store

```typescript
// app/web/src/store/pcb-store.ts

export type PcbEditorMode =
  | "select"           // Select/move components
  | "place-footprint"  // Placing footprints
  | "route"            // Interactive routing
  | "draw-track"       // Manual track drawing
  | "draw-zone"        // Drawing copper pours
  | "draw-keepout"     // Drawing keepout areas
  | "measure"          // Measurement tool
  | "edit-outline";    // Editing board outline

export type PcbTool =
  | "select"
  | "move"
  | "rotate"
  | "track"
  | "via"
  | "zone"
  | "keepout"
  | "line"
  | "arc"
  | "circle"
  | "polygon"
  | "text"
  | "dimension"
  | "delete";

interface PcbState {
  // Document
  pcb: PcbDocument;

  // View
  viewOffset: Vec2;
  zoom: number;
  view3d: boolean;  // Toggle 2D/3D view

  // Layer visibility
  visibleLayers: Set<LayerId>;
  activeLayer: LayerId;

  // Editor state
  mode: PcbEditorMode;
  activeTool: PcbTool;

  // Selection
  selectedInstances: Set<FootprintInstanceId>;
  selectedTraces: Set<TraceId>;
  selectedVias: Set<ViaId>;
  selectedZones: Set<CopperPourId>;

  // Hover
  hoveredInstance: FootprintInstanceId | null;
  hoveredPad: { instanceId: FootprintInstanceId; padId: PadId } | null;
  hoveredTrace: TraceId | null;

  // Routing state
  routingState: {
    netId: NetId;
    fromPad: { instanceId: FootprintInstanceId; padId: PadId };
    currentLayer: LayerId;
    segments: TraceSegment[];
    vias: Vec2[];
  } | null;

  // Track width (for manual routing)
  trackWidth: number;

  // Via settings
  viaSettings: {
    diameter: number;
    drillDiameter: number;
  };

  // Grid
  gridSize: number;
  snapToGrid: boolean;

  // Ratsnest
  showRatsnest: boolean;
  ratsnestNets: Set<NetId>;  // Which nets to show (empty = all)

  // DRC
  drcViolations: DrcViolation[];
  showDrcMarkers: boolean;

  // 3D view state
  camera3d: {
    position: Vec3;
    target: Vec3;
    up: Vec3;
  };
  show3dComponents: boolean;

  // History
  historyState: HistoryState<PcbDocument>;
}

interface PcbActions {
  // Document
  setPcb: (doc: PcbDocument) => void;

  // Board outline
  importOutline: (cadPath: string, sketchId: SketchId, profileIndex: number) => void;
  editOutline: (points: Vec2[]) => void;
  addCutout: (points: Vec2[]) => void;

  // View
  pan: (delta: Vec2) => void;
  setZoom: (zoom: number) => void;
  fitBoard: () => void;
  toggle3dView: () => void;

  // Layer
  setActiveLayer: (layerId: LayerId) => void;
  toggleLayerVisibility: (layerId: LayerId) => void;
  setLayerStack: (stack: LayerStack) => void;

  // Footprint operations
  placeFootprint: (footprintId: FootprintId, position: Vec2) => FootprintInstanceId;
  moveInstance: (instanceId: FootprintInstanceId, position: Vec2) => void;
  rotateInstance: (instanceId: FootprintInstanceId, angle: number) => void;
  flipInstance: (instanceId: FootprintInstanceId) => void;  // Top <-> Bottom
  lockInstance: (instanceId: FootprintInstanceId, locked: boolean) => void;
  deleteInstance: (instanceId: FootprintInstanceId) => void;

  // Routing
  startRoute: (fromPad: { instanceId: FootprintInstanceId; padId: PadId }) => void;
  addRouteSegment: (point: Vec2) => void;
  addVia: () => void;
  changeLayer: (layerId: LayerId) => void;
  finishRoute: () => TraceId | null;
  cancelRoute: () => void;

  // Manual track
  drawTrack: (points: Vec2[], width: number, layer: LayerId, netId?: NetId) => TraceId;
  editTrack: (traceId: TraceId, newPoints: Vec2[]) => void;
  deleteTrack: (traceId: TraceId) => void;

  // Vias
  placeVia: (position: Vec2, netId?: NetId) => ViaId;
  deleteVia: (viaId: ViaId) => void;

  // Copper pours
  createZone: (outline: Vec2[], layer: LayerId, netId?: NetId) => CopperPourId;
  refillZones: () => void;
  deleteZone: (zoneId: CopperPourId) => void;

  // Selection
  select: (ids: { instances?: FootprintInstanceId[]; traces?: TraceId[]; vias?: ViaId[] }) => void;
  clearSelection: () => void;
  selectNet: (netId: NetId) => void;

  // Design rules
  setDesignRules: (rules: DesignRules) => void;
  setNetClass: (classId: NetClassId, rules: NetClass) => void;

  // DRC
  runDrc: () => void;
  clearDrc: () => void;
  jumpToViolation: (violation: DrcViolation) => void;

  // Schematic sync
  syncFromSchematic: (schematicPath: string) => void;
  highlightNet: (netId: NetId) => void;

  // Export
  exportGerber: () => GerberFiles;
  exportDrill: () => DrillFile;
  exportPickPlace: () => PickPlaceFile;
  exportBom: () => BomFile;
  export3dModel: () => void;  // Generate .vibecad assembly

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}
```

### 4.4 Library Store

```typescript
// app/web/src/store/library-store.ts

interface LibraryState {
  // Loaded libraries
  libraries: Map<ComponentLibraryId, ComponentLibrary>;

  // Built-in libraries (always available)
  builtinLibraries: ComponentLibraryId[];

  // User libraries
  userLibraries: ComponentLibraryId[];

  // Search state
  searchQuery: string;
  searchResults: ComponentId[];

  // Selected for placement
  selectedComponent: ComponentId | null;

  // Import state
  importProgress: {
    status: "idle" | "importing" | "complete" | "error";
    source: string;
    progress: number;
    error?: string;
  };
}

interface LibraryActions {
  // Load libraries
  loadBuiltinLibraries: () => Promise<void>;
  loadLibrary: (path: string) => Promise<ComponentLibraryId>;
  unloadLibrary: (libraryId: ComponentLibraryId) => void;

  // Search
  searchComponents: (query: string, filters?: {
    category?: ComponentCategory;
    library?: ComponentLibraryId;
    hasFootprint?: boolean;
    has3dModel?: boolean;
  }) => void;

  // Component access
  getComponent: (componentId: ComponentId) => Component | undefined;
  getSymbol: (symbolId: SymbolId) => Symbol | undefined;
  getFootprint: (footprintId: FootprintId) => Footprint | undefined;
  get3dModel: (modelId: Model3dRefId) => Model3dRef | undefined;

  // Import from external sources
  importKicadLibrary: (symPath: string, modPath?: string) => Promise<ComponentLibraryId>;
  importFromSnapEda: (partNumber: string) => Promise<ComponentId>;
  importFromLcsc: (lcscPartNumber: string) => Promise<ComponentId>;

  // User library management
  createUserLibrary: (name: string) => ComponentLibraryId;
  addComponentToLibrary: (libraryId: ComponentLibraryId, component: Component) => void;
  createCustomSymbol: (libraryId: ComponentLibraryId, symbol: Symbol) => SymbolId;
  createCustomFootprint: (libraryId: ComponentLibraryId, footprint: Footprint) => FootprintId;

  // Export
  exportLibrary: (libraryId: ComponentLibraryId) => string;  // JSON
}
```

### 4.5 Tab Store Extensions

```typescript
// Extend tabs-store.ts

export type DocumentType =
  | "cad"
  | "schematic"  // NEW
  | "pcb"        // NEW
  | "image"
  | "text"
  | ...;

export interface SchematicDocument extends DocumentBase {
  type: "schematic";
  schematicDocumentId: string;  // Reference to schematic-store
}

export interface PcbDocument extends DocumentBase {
  type: "pcb";
  pcbDocumentId: string;  // Reference to pcb-store
}

// Update TabDocument union
export type TabDocument =
  | CadDocument
  | SchematicDocument  // NEW
  | PcbDocument        // NEW
  | ImageDocument
  | ...;
```

---

## Part 5: UI Components

### 5.1 Component Hierarchy

```
app/web/src/components/
├── cad/                    # Existing CAD components
│   ├── Viewport.tsx
│   ├── SketchCanvas.tsx
│   └── ...
│
├── schematic/              # NEW - Schematic editor components
│   ├── SchematicCanvas.tsx     # Main 2D canvas (SVG or Canvas)
│   ├── SymbolRenderer.tsx      # Renders symbol graphics
│   ├── WireRenderer.tsx        # Renders wires and junctions
│   ├── SchematicGrid.tsx       # Grid overlay
│   ├── SheetTabs.tsx           # Multi-sheet tabs
│   ├── ComponentBrowser.tsx    # Library browser panel
│   ├── NetNavigator.tsx        # Net list panel
│   ├── PropertyEditor.tsx      # Component properties
│   ├── ErcPanel.tsx            # ERC results
│   └── SchematicToolbar.tsx    # Schematic-specific tools
│
├── pcb/                    # NEW - PCB editor components
│   ├── PcbCanvas.tsx           # 2D PCB canvas
│   ├── Pcb3dView.tsx           # 3D board view (Three.js)
│   ├── FootprintRenderer.tsx   # Renders footprints
│   ├── TraceRenderer.tsx       # Renders traces
│   ├── LayerPanel.tsx          # Layer visibility/selection
│   ├── NetPanel.tsx            # Net list and ratsnest
│   ├── DrcPanel.tsx            # DRC results
│   ├── DesignRulesPanel.tsx    # Rule editor
│   ├── PcbToolbar.tsx          # PCB-specific tools
│   └── BoardStackup.tsx        # Layer stack editor
│
├── library/                # NEW - Shared library components
│   ├── LibraryBrowser.tsx      # Search and browse components
│   ├── ComponentCard.tsx       # Component preview card
│   ├── SymbolPreview.tsx       # Symbol graphic preview
│   ├── FootprintPreview.tsx    # Footprint preview
│   ├── Model3dPreview.tsx      # 3D model preview
│   └── LibraryManager.tsx      # Manage libraries
│
└── shared/                 # Shared UI components
    ├── Canvas2d.tsx            # Base 2D canvas with pan/zoom
    ├── PropertyGrid.tsx        # Generic property editor
    └── ...
```

### 5.2 Editor Layout Variations

```typescript
// Schematic editor layout
<EditorLayout
  leftPanel={<ComponentBrowser />}
  rightPanel={
    <>
      <PropertyEditor />
      <NetNavigator />
      <ErcPanel />
    </>
  }
  viewport={<SchematicCanvas />}
  toolbar={<SchematicToolbar />}
  statusBar={<SchematicStatus />}
/>

// PCB editor layout
<EditorLayout
  leftPanel={
    <>
      <LayerPanel />
      <NetPanel />
    </>
  }
  rightPanel={
    <>
      <PropertyEditor />
      <DesignRulesPanel />
      <DrcPanel />
    </>
  }
  viewport={view3d ? <Pcb3dView /> : <PcbCanvas />}
  toolbar={<PcbToolbar />}
  statusBar={<PcbStatus />}
/>
```

### 5.3 Schematic Canvas Implementation

```typescript
// app/web/src/components/schematic/SchematicCanvas.tsx

export function SchematicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    schematic,
    activeSheetId,
    zoom,
    viewOffset,
    mode,
    activeTool,
    selectedInstances,
    hoveredPin,
    wireDrawing,
    pendingSymbol,
  } = useSchematicStore();

  // Canvas rendering
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Apply view transform
    ctx.save();
    ctx.translate(viewOffset.x, viewOffset.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    drawGrid(ctx);

    // Draw wires
    for (const wire of getSheetWires(schematic, activeSheetId)) {
      drawWire(ctx, wire, selectedWires.has(wire.id));
    }

    // Draw junctions
    for (const junction of getSheetJunctions(schematic, activeSheetId)) {
      drawJunction(ctx, junction);
    }

    // Draw symbol instances
    for (const instance of getSheetInstances(schematic, activeSheetId)) {
      const symbol = schematic.symbols.get(instance.symbolId);
      if (symbol) {
        drawSymbolInstance(ctx, symbol, instance, {
          selected: selectedInstances.has(instance.id),
          hovered: hoveredInstance === instance.id,
        });
      }
    }

    // Draw net labels
    for (const label of getSheetLabels(schematic, activeSheetId)) {
      drawNetLabel(ctx, label);
    }

    // Draw wire being drawn
    if (wireDrawing) {
      drawWirePreview(ctx, wireDrawing.points, mousePos);
    }

    // Draw symbol being placed
    if (pendingSymbol) {
      const symbol = schematic.symbols.get(pendingSymbol.symbolId);
      if (symbol) {
        drawSymbolPreview(ctx, symbol, pendingSymbol);
      }
    }

    // Draw pin highlights
    if (hoveredPin) {
      highlightPin(ctx, hoveredPin);
    }

    ctx.restore();
  }, [schematic, activeSheetId, zoom, viewOffset, ...]);

  // Event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const gridPos = snapToGrid(worldPos);

    switch (activeTool) {
      case "select":
        handleSelect(worldPos);
        break;
      case "wire":
        handleWireClick(gridPos);
        break;
      case "place-symbol":
        handlePlaceSymbol(gridPos);
        break;
      // ...
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    />
  );
}
```

### 5.4 PCB 3D View

```typescript
// app/web/src/components/pcb/Pcb3dView.tsx

export function Pcb3dView() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { pcb, camera3d, show3dComponents } = usePcbStore();
  const { kernel } = useCadStore();  // Reuse CAD kernel for 3D

  useEffect(() => {
    // Set up Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, ...);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    // Add lights
    scene.add(new THREE.AmbientLight(0x404040));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.8));

    // Generate board mesh from outline
    const boardGeom = extrudeBoardOutline(pcb.boardOutline, pcb.meta.boardThickness);
    const boardMesh = new THREE.Mesh(boardGeom, new THREE.MeshStandardMaterial({
      color: 0x1a472a,  // PCB green
    }));
    scene.add(boardMesh);

    // Add copper layers
    for (const layer of pcb.layerStack.copperLayers) {
      const copperMesh = generateCopperMesh(pcb, layer);
      scene.add(copperMesh);
    }

    // Add silkscreen
    const silkMesh = generateSilkscreenMesh(pcb);
    scene.add(silkMesh);

    // Add component 3D models
    if (show3dComponents) {
      for (const instance of pcb.instances.values()) {
        const footprint = pcb.footprints.get(instance.footprintId);
        if (footprint?.model3d) {
          const model = loadModel3d(footprint.model3d);
          model.position.set(instance.position.x, instance.position.y, ...);
          model.rotation.set(...);
          if (instance.side === "bottom") {
            model.scale.z = -1;  // Flip
          }
          scene.add(model);
        }
      }
    }

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      renderer.dispose();
    };
  }, [pcb, show3dComponents]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
```

---

## Part 6: Cross-Document Integration

### 6.1 Profile Import from CAD

```typescript
// Import board outline from .vibecad sketch

async function importBoardOutline(
  cadPath: string,
  sketchId: SketchId,
  profileIndex: number
): Promise<Vec2[]> {
  // Load the CAD document
  const cadDoc = await loadVibecadFile(cadPath);

  // Get the sketch
  const sketch = cadDoc.partStudios.values().next().value?.sketches.get(sketchId);
  if (!sketch) throw new Error("Sketch not found");

  // Extract the profile loop
  const loops = detectClosedLoops(sketch);
  if (profileIndex >= loops.length) throw new Error("Profile index out of range");

  const loop = loops[profileIndex];

  // Convert to Vec2[] (flatten to XY plane)
  const points: Vec2[] = [];
  for (const segment of loop) {
    // Convert each primitive to points
    // Handle lines, arcs, etc.
    const segmentPoints = primitiveToPoints(segment, sketch);
    points.push(...segmentPoints);
  }

  return points;
}
```

### 6.2 Generate 3D PCB for CAD

```typescript
// Export PCB as .vibecad assembly for enclosure design

async function exportPcbToCad(pcb: PcbDocument): Promise<string> {
  // Create a new CAD document
  const cadDoc = createDocument(pcb.name + " - 3D");
  const studio = createPartStudio("PCB Assembly");

  // 1. Create board body from outline
  const boardSketchId = createSketchFromOutline(studio, pcb.boardOutline);
  const boardExtrudeId = createExtrude(studio, boardSketchId, pcb.meta.boardThickness);

  // 2. Add cutouts
  for (const cutout of pcb.boardOutline.cutouts) {
    const cutoutSketchId = createSketchFromPolygon(studio, cutout);
    createBooleanSubtract(studio, boardExtrudeId, cutoutSketchId);
  }

  // 3. Add component 3D models as InsertPart operations
  for (const instance of pcb.instances.values()) {
    const footprint = pcb.footprints.get(instance.footprintId);
    if (footprint?.model3d) {
      const insertOp: InsertPartOp = {
        id: newId("Op"),
        type: "insert-part",
        name: instance.refDes,
        suppressed: false,
        sourcePath: footprint.model3d.path,
        transform: computeTransform(instance, footprint.model3d),
      };
      studio.opGraph.set(insertOp.id, insertOp);
      studio.opOrder.push(insertOp.id);
    }
  }

  cadDoc.partStudios.set(studio.id, studio);

  // Serialize and return
  return serializeDocument(cadDoc);
}
```

### 6.3 Schematic to PCB Sync

```typescript
// Sync netlist from schematic to PCB

interface Netlist {
  components: Array<{
    refDes: string;
    value: string;
    footprint: FootprintId;
    properties: Map<string, string>;
  }>;
  nets: Array<{
    name: string;
    pins: Array<{ refDes: string; pin: string }>;
  }>;
}

function syncSchematicToPcb(schematic: SchematicDocument, pcb: PcbDocument): void {
  const netlist = generateNetlist(schematic);

  // 1. Add/update components
  for (const component of netlist.components) {
    const existing = findInstanceByRefDes(pcb, component.refDes);

    if (!existing) {
      // New component - add to placement queue
      addToPendingPlacement(pcb, {
        footprintId: component.footprint,
        refDes: component.refDes,
        value: component.value,
      });
    } else {
      // Update existing
      updateInstance(pcb, existing.id, {
        value: component.value,
        footprintId: component.footprint,
      });
    }
  }

  // 2. Sync nets
  for (const net of netlist.nets) {
    const pcbNet = pcb.nets.get(net.name) || createNet(net.name);

    // Update pad assignments
    pcbNet.pads = net.pins.map(pin => {
      const instance = findInstanceByRefDes(pcb, pin.refDes);
      const pad = findPadByNumber(instance, pin.pin);
      return { instanceId: instance.id, padId: pad.id };
    });

    pcb.nets.set(net.name, pcbNet);
  }

  // 3. Recalculate ratsnest
  recalculateRatsnest(pcb);

  // 4. Flag removed components
  for (const instance of pcb.instances.values()) {
    if (!netlist.components.find(c => c.refDes === instance.refDes)) {
      flagAsOrphan(instance);
    }
  }
}
```

---

## Part 7: Manufacturing Output

### 7.1 Gerber Export

```typescript
// Gerber RS-274X format export

interface GerberFiles {
  topCopper: string;      // .GTL
  bottomCopper: string;   // .GBL
  innerLayers: Map<number, string>;  // .G2, .G3, etc.
  topSilkscreen: string;  // .GTO
  bottomSilkscreen: string; // .GBO
  topSoldermask: string;  // .GTS
  bottomSoldermask: string; // .GBS
  topPaste: string;       // .GTP
  bottomPaste: string;    // .GBP
  outline: string;        // .GKO
  drillPlated: string;    // .DRL or .XLN
  drillNonPlated: string; // .DRL
}

function exportGerber(pcb: PcbDocument): GerberFiles {
  const files: GerberFiles = {} as GerberFiles;

  // Generate aperture list
  const apertures = generateApertureList(pcb);

  // Export each layer
  for (const [layerId, layer] of pcb.layers) {
    if (layer.type === "copper") {
      const gerber = generateCopperGerber(pcb, layerId, apertures);
      // Assign to appropriate file based on stack position
    }
    // ... other layer types
  }

  // Generate drill file (Excellon format)
  files.drillPlated = generateExcellonDrill(pcb, { plated: true });
  files.drillNonPlated = generateExcellonDrill(pcb, { plated: false });

  return files;
}
```

### 7.2 Pick and Place Export

```typescript
interface PickPlaceEntry {
  refDes: string;
  value: string;
  package: string;
  centerX: number;
  centerY: number;
  rotation: number;
  side: "top" | "bottom";
  lcscPartNumber?: string;
}

function exportPickPlace(pcb: PcbDocument): string {
  const entries: PickPlaceEntry[] = [];

  for (const instance of pcb.instances.values()) {
    const footprint = pcb.footprints.get(instance.footprintId);
    entries.push({
      refDes: instance.refDes,
      value: instance.value,
      package: footprint?.name || "",
      centerX: instance.position.x,
      centerY: instance.position.y,
      rotation: instance.rotation,
      side: instance.side,
      lcscPartNumber: instance.properties.get("LCSC"),
    });
  }

  // Format as CSV
  return formatPickPlaceCsv(entries);
}
```

### 7.3 BOM Export

```typescript
interface BomEntry {
  quantity: number;
  refDes: string[];
  value: string;
  footprint: string;
  manufacturer?: string;
  partNumber?: string;
  lcscPartNumber?: string;
  description?: string;
}

function exportBom(pcb: PcbDocument): BomEntry[] {
  // Group by value + footprint
  const groups = new Map<string, BomEntry>();

  for (const instance of pcb.instances.values()) {
    const key = `${instance.value}|${instance.footprintId}`;
    const existing = groups.get(key);

    if (existing) {
      existing.quantity++;
      existing.refDes.push(instance.refDes);
    } else {
      groups.set(key, {
        quantity: 1,
        refDes: [instance.refDes],
        value: instance.value,
        footprint: pcb.footprints.get(instance.footprintId)?.name || "",
        manufacturer: instance.properties.get("Manufacturer"),
        partNumber: instance.properties.get("MPN"),
        lcscPartNumber: instance.properties.get("LCSC"),
        description: instance.properties.get("Description"),
      });
    }
  }

  return Array.from(groups.values());
}
```

---

## Part 8: DRC and ERC Implementation

### 8.1 Electrical Rule Check (ERC)

```typescript
// Schematic electrical rule checking

export type ErcViolationType =
  | "unconnected_pin"
  | "input_not_driven"
  | "output_conflict"
  | "power_not_connected"
  | "duplicate_refdes"
  | "missing_value"
  | "bidirectional_conflict"
  | "no_connect_connected";

function runErc(schematic: SchematicDocument): ErcViolation[] {
  const violations: ErcViolation[] = [];

  // 1. Check all pins are connected or marked no-connect
  for (const instance of schematic.symbolInstances.values()) {
    const symbol = schematic.symbols.get(instance.symbolId);
    if (!symbol) continue;

    for (const [pinId, pin] of symbol.pins) {
      if (pin.type === "not_connected") continue;

      const connected = isPinConnected(schematic, instance.id, pinId);
      if (!connected) {
        violations.push({
          type: "unconnected_pin",
          severity: pin.type === "power_in" ? "error" : "warning",
          message: `Unconnected ${pin.type} pin ${pin.name} on ${instance.refDes}`,
          location: getPinWorldPosition(instance, pin),
          elements: [{ type: "pin", instanceId: instance.id, pinId }],
        });
      }
    }
  }

  // 2. Check nets have drivers
  for (const [netId, net] of schematic.nets) {
    const drivers = getNetDrivers(schematic, net);
    const inputs = getNetInputs(schematic, net);

    if (drivers.length === 0 && inputs.length > 0) {
      violations.push({
        type: "input_not_driven",
        severity: "error",
        message: `Net ${net.name} has inputs but no driver`,
        location: getNetLabelPosition(schematic, netId),
        elements: [{ type: "net", netId }],
      });
    }

    if (drivers.length > 1) {
      violations.push({
        type: "output_conflict",
        severity: "error",
        message: `Net ${net.name} has multiple drivers`,
        location: getNetLabelPosition(schematic, netId),
        elements: drivers.map(d => ({ type: "pin", ...d })),
      });
    }
  }

  // 3. Check reference designators
  const refDesMap = new Map<string, SymbolInstanceId[]>();
  for (const instance of schematic.symbolInstances.values()) {
    const existing = refDesMap.get(instance.refDes) || [];
    existing.push(instance.id);
    refDesMap.set(instance.refDes, existing);
  }

  for (const [refDes, instances] of refDesMap) {
    if (instances.length > 1) {
      violations.push({
        type: "duplicate_refdes",
        severity: "error",
        message: `Duplicate reference designator: ${refDes}`,
        location: getInstancePosition(schematic, instances[0]),
        elements: instances.map(id => ({ type: "instance", instanceId: id })),
      });
    }
  }

  return violations;
}
```

### 8.2 Design Rule Check (DRC)

```typescript
// PCB design rule checking

function runDrc(pcb: PcbDocument): DrcViolation[] {
  const violations: DrcViolation[] = [];
  const rules = pcb.designRules;

  // 1. Clearance checks
  violations.push(...checkClearances(pcb, rules));

  // 2. Track width checks
  for (const trace of pcb.traces.values()) {
    const minWidth = getMinTraceWidth(rules, trace.netId);
    for (const segment of trace.segments) {
      if (segment.width < minWidth) {
        violations.push({
          type: "trace_width",
          severity: "error",
          message: `Track width ${segment.width}mm below minimum ${minWidth}mm`,
          location: midpoint(segment.start, segment.end),
          elements: [{ type: "trace", id: trace.id }],
        });
      }
    }
  }

  // 3. Annular ring checks
  for (const via of pcb.vias.values()) {
    const annularRing = (via.diameter - via.drillDiameter) / 2;
    if (annularRing < rules.minAnnularRing) {
      violations.push({
        type: "annular_ring",
        severity: "error",
        message: `Via annular ring ${annularRing}mm below minimum ${rules.minAnnularRing}mm`,
        location: via.position,
        elements: [{ type: "via", id: via.id }],
      });
    }
  }

  // 4. Unconnected nets (ratsnest check)
  for (const [netId, net] of pcb.nets) {
    if (net.ratsnest && net.ratsnest.length > 0) {
      violations.push({
        type: "unconnected",
        severity: "error",
        message: `Net ${net.name} has ${net.ratsnest.length} unrouted connections`,
        location: net.ratsnest[0].from,
        elements: [{ type: "net", id: netId }],
      });
    }
  }

  // 5. Drill size checks
  for (const via of pcb.vias.values()) {
    if (via.drillDiameter < rules.minViaDrill) {
      violations.push({
        type: "drill_size",
        severity: "error",
        message: `Via drill ${via.drillDiameter}mm below minimum ${rules.minViaDrill}mm`,
        location: via.position,
        elements: [{ type: "via", id: via.id }],
      });
    }
  }

  // 6. Courtyard overlap checks
  violations.push(...checkCourtyardOverlaps(pcb));

  return violations;
}

function checkClearances(pcb: PcbDocument, rules: DesignRules): DrcViolation[] {
  const violations: DrcViolation[] = [];

  // Build spatial index for fast queries
  const spatialIndex = buildSpatialIndex(pcb);

  // Check trace-to-trace clearances
  for (const trace of pcb.traces.values()) {
    const nearbyTraces = spatialIndex.queryTraces(trace.bounds);

    for (const otherTrace of nearbyTraces) {
      if (trace.id === otherTrace.id) continue;
      if (trace.netId === otherTrace.netId) continue;  // Same net OK

      const clearance = getClearance(rules, trace.netId, otherTrace.netId);
      const distance = traceToTraceDistance(trace, otherTrace);

      if (distance < clearance) {
        violations.push({
          type: "clearance",
          severity: "error",
          message: `Clearance ${distance.toFixed(3)}mm between traces below ${clearance}mm`,
          location: getClosestPoint(trace, otherTrace),
          elements: [
            { type: "trace", id: trace.id },
            { type: "trace", id: otherTrace.id },
          ],
        });
      }
    }
  }

  // Check trace-to-pad, via-to-trace, via-to-via, etc.
  // ... similar pattern

  return violations;
}
```

---

## Part 9: Implementation Phases

### Phase 1: Foundation (Core Types + Basic Schematic)
- [ ] Add new ID types to `packages/core/src/types/id.ts`
- [ ] Create `packages/core/src/types/schematic/` with all schematic types
- [ ] Create `packages/core/src/types/pcb/` with all PCB types
- [ ] Create `packages/core/src/types/library/` with component library types
- [ ] Extend `tabs-store.ts` with new document types
- [ ] Create basic `schematic-store.ts`
- [ ] Create `SchematicCanvas.tsx` with grid and pan/zoom
- [ ] Implement symbol rendering
- [ ] Implement wire drawing

### Phase 2: Schematic Editor Complete
- [ ] Implement component browser with search
- [ ] Add net label placement
- [ ] Add hierarchical sheets
- [ ] Implement ERC
- [ ] Add schematic export (PDF, netlist)
- [ ] Built-in symbol library (basic passives, common ICs)

### Phase 3: PCB Editor Foundation
- [ ] Create `pcb-store.ts`
- [ ] Create `PcbCanvas.tsx` with layer rendering
- [ ] Implement board outline import from CAD
- [ ] Implement footprint placement
- [ ] Implement basic manual routing
- [ ] Layer stack editor

### Phase 4: PCB Editor Complete
- [ ] Copper pour/zone implementation
- [ ] Full DRC implementation
- [ ] Gerber export
- [ ] Drill file export
- [ ] Pick and place export
- [ ] BOM export

### Phase 5: 3D Integration
- [ ] Create `Pcb3dView.tsx`
- [ ] Load 3D models from library
- [ ] Export PCB to CAD assembly
- [ ] Component 3D model preview in library browser

### Phase 6: Library System
- [ ] Create `library-store.ts`
- [ ] Built-in component library
- [ ] KiCad library import
- [ ] User library creation
- [ ] Optional: SnapEDA/LCSC integration

### Phase 7: Advanced Features
- [ ] Interactive router (push-and-shove)
- [ ] Differential pair routing
- [ ] Length tuning
- [ ] Component placement optimization
- [ ] Cross-probe (schematic ↔ PCB highlighting)

---

## Part 10: Technical Considerations

### 10.1 Performance

**Schematic Canvas:**
- Use Canvas2D for drawing (faster than SVG for many elements)
- Implement culling - only draw visible elements
- Cache symbol graphics as ImageBitmap
- Use requestAnimationFrame for smooth pan/zoom

**PCB Canvas:**
- Layer rendering with off-screen canvases
- Only redraw changed layers
- Use WebGL for 3D view (Three.js)
- Spatial indexing (R-tree) for DRC and hit testing

### 10.2 File Size

**Schematic:** Typically small (<1MB)
- Mostly references to library symbols
- Wire coordinates
- Net connectivity

**PCB:** Can be large (10-100MB with pours)
- Store copper pours as outlines, regenerate fills
- Compress trace segments
- Consider binary format for production

### 10.3 Undo/Redo

Reuse existing `packages/core/src/history/` pattern:
- Each store has its own history state
- Batch related operations
- Don't push on hover/preview changes

### 10.4 Keyboard Shortcuts

```typescript
// Schematic
"W" - Wire tool
"E" - Edit properties
"R" - Rotate component
"X" - Mirror X
"Y" - Mirror Y
"C" - Copy
"V" - Paste
"Delete" - Delete selection
"Escape" - Cancel operation
"Ctrl+Z" - Undo
"Ctrl+Shift+Z" - Redo

// PCB
"T" - Track tool
"V" - Via
"P" - Place footprint
"R" - Rotate
"F" - Flip (top/bottom)
"X" - Lock/unlock
"N" - Toggle ratsnest
"L" - Change layer
"+" / "-" - Track width up/down
"3" - Toggle 3D view
```

---

## Summary

This plan provides a complete architecture for adding EDA capabilities to vibeCAD:

1. **Clean type system** following existing patterns (branded IDs, immutable updates)
2. **Separate stores** for schematic and PCB, similar to CAD store
3. **Reusable UI patterns** (EditorLayout, Canvas2d, PropertyGrid)
4. **Full cross-document integration** (CAD profiles → PCB outline, PCB → 3D CAD)
5. **Real component libraries** with import from KiCad, LCSC, etc.
6. **Manufacturing output** (Gerber, drill, BOM, pick-and-place)
7. **DRC/ERC** for professional-quality designs

The implementation follows vibeCAD's "1 file = 1 operation graph = 1 tab" philosophy while adding domain-specific features for electronics design.
