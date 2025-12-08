/**
 * PCB Document - top-level container for a PCB design.
 */

import {
  PcbDocId,
  LayerId,
  FootprintId,
  FootprintInstanceId,
  TraceId,
  ViaId,
  CopperPourId,
  NetId,
  NetClassId,
  SketchId,
  newId,
} from "../id";
import { Vec2 } from "../math";
import { Layer, LayerStack, create2LayerStack } from "./layer";
import { Footprint } from "./footprint";
import { FootprintInstance } from "./instance";
import { Trace, Via } from "./trace";
import { CopperPour } from "./zone";
import { DesignRules, DrcViolation, createDefaultDesignRules } from "./drc";

// ============================================================================
// Board Outline
// ============================================================================

export interface BoardOutlineSourceRef {
  path: string; // Relative path to .vibecad file
  sketchId: SketchId;
  profileIndex: number;
}

export interface BoardOutline {
  // Main outline (closed polygon, counterclockwise)
  outline: Vec2[];

  // Cutouts/holes (clockwise orientation)
  cutouts: Vec2[][];

  // Source reference (if imported from CAD)
  sourceRef?: BoardOutlineSourceRef;
}

// ============================================================================
// PCB Net (routing-specific)
// ============================================================================

export interface PcbNet {
  name: string;
  classId?: NetClassId;

  // Connected pads
  pads: Array<{ instanceId: FootprintInstanceId; padId: string }>;

  // Ratsnest (unrouted connections)
  ratsnest?: Array<{ from: Vec2; to: Vec2 }>;

  // Routed status
  isFullyRouted?: boolean;
}

// ============================================================================
// Net Class
// ============================================================================

export interface PcbNetClass {
  id: NetClassId;
  name: string;

  // Routing rules
  traceWidth: number; // mm
  clearance: number; // mm
  viaSize: number; // mm
  viaDrill: number; // mm

  // Differential pair
  diffPair?: boolean;
  diffPairGap?: number;
  diffPairViaGap?: number;

  // Advanced
  maxTraceLength?: number;
  minTraceLength?: number;
}

// ============================================================================
// PCB Metadata
// ============================================================================

export interface PcbDocumentMeta {
  createdAt: number;
  modifiedAt: number;
  version: number;

  // Board physical properties
  boardThickness: number; // mm (typically 1.6)
  copperWeight: number; // oz/ft^2 (typically 1)
  finishType: "HASL" | "ENIG" | "OSP" | "immersion_tin" | "immersion_silver";

  // Design info
  title?: string;
  revision?: string;
  author?: string;
  company?: string;
}

// ============================================================================
// Grid Settings
// ============================================================================

export interface GridSettings {
  visible: boolean;
  spacing: number; // mm
  snap: boolean;
}

// ============================================================================
// PCB Document
// ============================================================================

export interface PcbDocument {
  id: PcbDocId;
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
  nets: Map<NetId, PcbNet>;
  netClasses: Map<NetClassId, PcbNetClass>;
  defaultNetClassId?: NetClassId;

  // Design rules
  designRules: DesignRules;

  // DRC results (computed)
  drcViolations?: DrcViolation[];

  // Linked schematic
  linkedSchematicPath?: string;

  // Units
  units: "mm" | "mils";

  // Grid
  grid: GridSettings;

  // Metadata
  meta: PcbDocumentMeta;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new empty PCB document.
 */
export function createPcbDocument(name: string): PcbDocument {
  const now = Date.now();
  const { layers, stack } = create2LayerStack();

  return {
    id: newId("PcbDoc"),
    name,
    boardOutline: {
      outline: [], // Empty outline - needs to be set
      cutouts: [],
    },
    layerStack: stack,
    layers,
    footprints: new Map(),
    instances: new Map(),
    traces: new Map(),
    vias: new Map(),
    copperPours: new Map(),
    nets: new Map(),
    netClasses: new Map(),
    designRules: createDefaultDesignRules(),
    units: "mm",
    grid: {
      visible: true,
      spacing: 0.5, // 0.5mm grid
      snap: true,
    },
    meta: {
      createdAt: now,
      modifiedAt: now,
      version: 1,
      boardThickness: 1.6,
      copperWeight: 1,
      finishType: "HASL",
    },
  };
}

/**
 * Create a PCB with a rectangular board outline.
 */
export function createPcbDocumentWithBoard(
  name: string,
  width: number,
  height: number
): PcbDocument {
  const doc = createPcbDocument(name);

  // Create rectangular outline centered at origin
  const halfW = width / 2;
  const halfH = height / 2;
  doc.boardOutline.outline = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ];

  return doc;
}

// ============================================================================
// Document Operations (Immutable)
// ============================================================================

/**
 * Update document metadata (modifiedAt, version).
 */
export function touchPcbDocument(doc: PcbDocument): PcbDocument {
  return {
    ...doc,
    meta: {
      ...doc.meta,
      modifiedAt: Date.now(),
      version: doc.meta.version + 1,
    },
  };
}

/**
 * Set the board outline.
 */
export function setBoardOutline(
  doc: PcbDocument,
  outline: Vec2[],
  sourceRef?: BoardOutlineSourceRef
): PcbDocument {
  return touchPcbDocument({
    ...doc,
    boardOutline: {
      ...doc.boardOutline,
      outline,
      sourceRef,
    },
  });
}

/**
 * Add a board cutout.
 */
export function addBoardCutout(doc: PcbDocument, cutout: Vec2[]): PcbDocument {
  return touchPcbDocument({
    ...doc,
    boardOutline: {
      ...doc.boardOutline,
      cutouts: [...doc.boardOutline.cutouts, cutout],
    },
  });
}

/**
 * Add a footprint definition.
 */
export function addFootprint(doc: PcbDocument, footprint: Footprint): PcbDocument {
  const newFootprints = new Map(doc.footprints);
  newFootprints.set(footprint.id, footprint);
  return touchPcbDocument({ ...doc, footprints: newFootprints });
}

/**
 * Add a footprint instance.
 */
export function addFootprintInstance(
  doc: PcbDocument,
  instance: FootprintInstance
): PcbDocument {
  const newInstances = new Map(doc.instances);
  newInstances.set(instance.id, instance);
  return touchPcbDocument({ ...doc, instances: newInstances });
}

/**
 * Update a footprint instance.
 */
export function updateFootprintInstance(
  doc: PcbDocument,
  instance: FootprintInstance
): PcbDocument {
  if (!doc.instances.has(instance.id)) {
    return doc;
  }
  const newInstances = new Map(doc.instances);
  newInstances.set(instance.id, instance);
  return touchPcbDocument({ ...doc, instances: newInstances });
}

/**
 * Delete a footprint instance.
 */
export function deleteFootprintInstance(
  doc: PcbDocument,
  instanceId: FootprintInstanceId
): PcbDocument {
  const newInstances = new Map(doc.instances);
  newInstances.delete(instanceId);
  return touchPcbDocument({ ...doc, instances: newInstances });
}

/**
 * Add a trace.
 */
export function addTrace(doc: PcbDocument, trace: Trace): PcbDocument {
  const newTraces = new Map(doc.traces);
  newTraces.set(trace.id, trace);
  return touchPcbDocument({ ...doc, traces: newTraces });
}

/**
 * Update a trace.
 */
export function updateTrace(doc: PcbDocument, trace: Trace): PcbDocument {
  if (!doc.traces.has(trace.id)) {
    return doc;
  }
  const newTraces = new Map(doc.traces);
  newTraces.set(trace.id, trace);
  return touchPcbDocument({ ...doc, traces: newTraces });
}

/**
 * Delete a trace.
 */
export function deleteTrace(doc: PcbDocument, traceId: TraceId): PcbDocument {
  const newTraces = new Map(doc.traces);
  newTraces.delete(traceId);
  return touchPcbDocument({ ...doc, traces: newTraces });
}

/**
 * Add a via.
 */
export function addVia(doc: PcbDocument, via: Via): PcbDocument {
  const newVias = new Map(doc.vias);
  newVias.set(via.id, via);
  return touchPcbDocument({ ...doc, vias: newVias });
}

/**
 * Delete a via.
 */
export function deleteVia(doc: PcbDocument, viaId: ViaId): PcbDocument {
  const newVias = new Map(doc.vias);
  newVias.delete(viaId);
  return touchPcbDocument({ ...doc, vias: newVias });
}

/**
 * Add a copper pour.
 */
export function addCopperPour(doc: PcbDocument, pour: CopperPour): PcbDocument {
  const newPours = new Map(doc.copperPours);
  newPours.set(pour.id, pour);
  return touchPcbDocument({ ...doc, copperPours: newPours });
}

/**
 * Update a copper pour.
 */
export function updateCopperPour(doc: PcbDocument, pour: CopperPour): PcbDocument {
  if (!doc.copperPours.has(pour.id)) {
    return doc;
  }
  const newPours = new Map(doc.copperPours);
  newPours.set(pour.id, pour);
  return touchPcbDocument({ ...doc, copperPours: newPours });
}

/**
 * Delete a copper pour.
 */
export function deleteCopperPour(doc: PcbDocument, pourId: CopperPourId): PcbDocument {
  const newPours = new Map(doc.copperPours);
  newPours.delete(pourId);
  return touchPcbDocument({ ...doc, copperPours: newPours });
}

/**
 * Add/update a net.
 */
export function setNet(doc: PcbDocument, netId: NetId, net: PcbNet): PcbDocument {
  const newNets = new Map(doc.nets);
  newNets.set(netId, net);
  return touchPcbDocument({ ...doc, nets: newNets });
}

/**
 * Add a net class.
 */
export function addNetClass(doc: PcbDocument, netClass: PcbNetClass): PcbDocument {
  const newClasses = new Map(doc.netClasses);
  newClasses.set(netClass.id, netClass);
  return touchPcbDocument({ ...doc, netClasses: newClasses });
}

/**
 * Set design rules.
 */
export function setDesignRules(doc: PcbDocument, rules: DesignRules): PcbDocument {
  return touchPcbDocument({ ...doc, designRules: rules });
}

/**
 * Set DRC violations.
 */
export function setDrcViolations(
  doc: PcbDocument,
  violations: DrcViolation[] | undefined
): PcbDocument {
  return { ...doc, drcViolations: violations };
}

/**
 * Set linked schematic path.
 */
export function setLinkedSchematic(
  doc: PcbDocument,
  path: string | undefined
): PcbDocument {
  return touchPcbDocument({ ...doc, linkedSchematicPath: path });
}

/**
 * Set grid settings.
 */
export function setGridSettings(doc: PcbDocument, grid: GridSettings): PcbDocument {
  return touchPcbDocument({ ...doc, grid });
}

/**
 * Rename document.
 */
export function renamePcbDocument(doc: PcbDocument, name: string): PcbDocument {
  return touchPcbDocument({ ...doc, name });
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all traces on a specific layer.
 */
export function getTracesOnLayer(doc: PcbDocument, layerId: LayerId): Trace[] {
  return Array.from(doc.traces.values()).filter((t) => t.layerId === layerId);
}

/**
 * Get all traces for a specific net.
 */
export function getTracesForNet(doc: PcbDocument, netId: NetId): Trace[] {
  return Array.from(doc.traces.values()).filter((t) => t.netId === netId);
}

/**
 * Get all vias for a specific net.
 */
export function getViasForNet(doc: PcbDocument, netId: NetId): Via[] {
  return Array.from(doc.vias.values()).filter((v) => v.netId === netId);
}

/**
 * Get all copper pours on a specific layer.
 */
export function getPoursOnLayer(doc: PcbDocument, layerId: LayerId): CopperPour[] {
  return Array.from(doc.copperPours.values()).filter((p) => p.layerId === layerId);
}

/**
 * Get the top copper layer ID.
 */
export function getTopCopperLayer(doc: PcbDocument): LayerId | null {
  if (doc.layerStack.copperLayers.length === 0) return null;
  return doc.layerStack.copperLayers[0];
}

/**
 * Get the bottom copper layer ID.
 */
export function getBottomCopperLayer(doc: PcbDocument): LayerId | null {
  if (doc.layerStack.copperLayers.length === 0) return null;
  return doc.layerStack.copperLayers[doc.layerStack.copperLayers.length - 1];
}

/**
 * Get board bounds.
 */
export function getBoardBounds(doc: PcbDocument): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (doc.boardOutline.outline.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of doc.boardOutline.outline) {
    minX = Math.min(minX, pt[0]);
    minY = Math.min(minY, pt[1]);
    maxX = Math.max(maxX, pt[0]);
    maxY = Math.max(maxY, pt[1]);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Get board area in mm^2.
 */
export function getBoardArea(doc: PcbDocument): number {
  // Shoelace formula
  const outline = doc.boardOutline.outline;
  let area = 0;
  const n = outline.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += outline[i][0] * outline[j][1];
    area -= outline[j][0] * outline[i][1];
  }

  return Math.abs(area) / 2;
}

/**
 * Find instance by reference designator.
 */
export function findInstanceByRefDes(
  doc: PcbDocument,
  refDes: string
): FootprintInstance | undefined {
  for (const instance of doc.instances.values()) {
    if (instance.refDes === refDes) {
      return instance;
    }
  }
  return undefined;
}
