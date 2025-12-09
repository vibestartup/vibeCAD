/**
 * Schematic Document - top-level container for a schematic design.
 *
 * Design: 1 file = 1 schematic = 1 tab
 * Each schematic file contains a single sheet. Multi-sheet designs are
 * implemented as separate files that can reference each other via ports.
 */

import {
  SchematicDocId,
  SymbolId,
  SymbolInstanceId,
  NetId,
  WireId,
  NetLabelId,
  PortId,
  NetClassId,
  JunctionId,
  ComponentLibraryId,
  newId,
} from "../id";
import { Symbol } from "./symbol";
import { SymbolInstance } from "./instance";
import { Net, Wire, Junction, NetLabel, Port, NetClass } from "./net";
import { SheetSize, createSheetSize } from "./sheet";

// ============================================================================
// Schematic Document
// ============================================================================

export interface SchematicDocumentMeta {
  createdAt: number;
  modifiedAt: number;
  version: number;
  title?: string;
  revision?: string;
  author?: string;
  company?: string;
  comment?: string;
}

export interface SchematicDocument {
  id: SchematicDocId;
  name: string;

  // Sheet size (for display/printing)
  sheetSize: SheetSize;

  // Symbols (library of symbol definitions used in this schematic)
  symbols: Map<SymbolId, Symbol>;

  // Symbol instances (placed symbols)
  symbolInstances: Map<SymbolInstanceId, SymbolInstance>;

  // Connectivity
  nets: Map<NetId, Net>;
  wires: Map<WireId, Wire>;
  junctions: Map<JunctionId, Junction>;
  netLabels: Map<NetLabelId, NetLabel>;
  ports: Map<PortId, Port>;

  // Net classes (routing rules)
  netClasses: Map<NetClassId, NetClass>;
  defaultNetClassId?: NetClassId;

  // Referenced component libraries
  libraries: ComponentLibraryId[];

  // Linked PCB (optional)
  linkedPcbPath?: string;

  // Metadata
  meta: SchematicDocumentMeta;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new empty schematic document.
 */
export function createSchematicDocument(name: string): SchematicDocument {
  const now = Date.now();

  return {
    id: newId("SchematicDoc"),
    name,
    sheetSize: createSheetSize("A4", true),
    symbols: new Map(),
    symbolInstances: new Map(),
    nets: new Map(),
    wires: new Map(),
    junctions: new Map(),
    netLabels: new Map(),
    ports: new Map(),
    netClasses: new Map(),
    libraries: [],
    meta: {
      createdAt: now,
      modifiedAt: now,
      version: 1,
    },
  };
}

// ============================================================================
// Document Operations (Immutable)
// ============================================================================

/**
 * Update document metadata (modifiedAt, version).
 */
export function touchSchematicDocument(doc: SchematicDocument): SchematicDocument {
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
 * Set the document's sheet size.
 */
export function setDocumentSheetSize(
  doc: SchematicDocument,
  size: SheetSize
): SchematicDocument {
  return touchSchematicDocument({ ...doc, sheetSize: size });
}

/**
 * Add a symbol definition.
 */
export function addSymbol(doc: SchematicDocument, symbol: Symbol): SchematicDocument {
  const newSymbols = new Map(doc.symbols);
  newSymbols.set(symbol.id, symbol);
  return touchSchematicDocument({ ...doc, symbols: newSymbols });
}

/**
 * Add a symbol instance.
 */
export function addSymbolInstance(
  doc: SchematicDocument,
  instance: SymbolInstance
): SchematicDocument {
  const newInstances = new Map(doc.symbolInstances);
  newInstances.set(instance.id, instance);
  return touchSchematicDocument({ ...doc, symbolInstances: newInstances });
}

/**
 * Update a symbol instance.
 */
export function updateSymbolInstance(
  doc: SchematicDocument,
  instance: SymbolInstance
): SchematicDocument {
  if (!doc.symbolInstances.has(instance.id)) {
    return doc;
  }
  const newInstances = new Map(doc.symbolInstances);
  newInstances.set(instance.id, instance);
  return touchSchematicDocument({ ...doc, symbolInstances: newInstances });
}

/**
 * Delete a symbol instance.
 */
export function deleteSymbolInstance(
  doc: SchematicDocument,
  instanceId: SymbolInstanceId
): SchematicDocument {
  if (!doc.symbolInstances.has(instanceId)) {
    return doc;
  }
  const newInstances = new Map(doc.symbolInstances);
  newInstances.delete(instanceId);
  return touchSchematicDocument({ ...doc, symbolInstances: newInstances });
}

/**
 * Add a wire.
 */
export function addWire(doc: SchematicDocument, wire: Wire): SchematicDocument {
  const newWires = new Map(doc.wires);
  newWires.set(wire.id, wire);
  return touchSchematicDocument({ ...doc, wires: newWires });
}

/**
 * Delete a wire.
 */
export function deleteWire(doc: SchematicDocument, wireId: WireId): SchematicDocument {
  if (!doc.wires.has(wireId)) {
    return doc;
  }
  const newWires = new Map(doc.wires);
  newWires.delete(wireId);
  return touchSchematicDocument({ ...doc, wires: newWires });
}

/**
 * Add a net.
 */
export function addNet(doc: SchematicDocument, net: Net): SchematicDocument {
  const newNets = new Map(doc.nets);
  newNets.set(net.id, net);
  return touchSchematicDocument({ ...doc, nets: newNets });
}

/**
 * Update a net.
 */
export function updateNet(doc: SchematicDocument, net: Net): SchematicDocument {
  if (!doc.nets.has(net.id)) {
    return doc;
  }
  const newNets = new Map(doc.nets);
  newNets.set(net.id, net);
  return touchSchematicDocument({ ...doc, nets: newNets });
}

/**
 * Add a junction.
 */
export function addJunction(
  doc: SchematicDocument,
  junction: Junction
): SchematicDocument {
  const newJunctions = new Map(doc.junctions);
  newJunctions.set(junction.id, junction);
  return touchSchematicDocument({ ...doc, junctions: newJunctions });
}

/**
 * Delete a junction.
 */
export function deleteJunction(
  doc: SchematicDocument,
  junctionId: JunctionId
): SchematicDocument {
  if (!doc.junctions.has(junctionId)) {
    return doc;
  }
  const newJunctions = new Map(doc.junctions);
  newJunctions.delete(junctionId);
  return touchSchematicDocument({ ...doc, junctions: newJunctions });
}

/**
 * Add a net label.
 */
export function addNetLabel(
  doc: SchematicDocument,
  label: NetLabel
): SchematicDocument {
  const newLabels = new Map(doc.netLabels);
  newLabels.set(label.id, label);
  return touchSchematicDocument({ ...doc, netLabels: newLabels });
}

/**
 * Delete a net label.
 */
export function deleteNetLabel(
  doc: SchematicDocument,
  labelId: NetLabelId
): SchematicDocument {
  if (!doc.netLabels.has(labelId)) {
    return doc;
  }
  const newLabels = new Map(doc.netLabels);
  newLabels.delete(labelId);
  return touchSchematicDocument({ ...doc, netLabels: newLabels });
}

/**
 * Add a port.
 */
export function addPort(
  doc: SchematicDocument,
  port: Port
): SchematicDocument {
  const newPorts = new Map(doc.ports);
  newPorts.set(port.id, port);
  return touchSchematicDocument({ ...doc, ports: newPorts });
}

/**
 * Delete a port.
 */
export function deletePort(
  doc: SchematicDocument,
  portId: PortId
): SchematicDocument {
  if (!doc.ports.has(portId)) {
    return doc;
  }
  const newPorts = new Map(doc.ports);
  newPorts.delete(portId);
  return touchSchematicDocument({ ...doc, ports: newPorts });
}

/**
 * Add a net class.
 */
export function addNetClass(
  doc: SchematicDocument,
  netClass: NetClass
): SchematicDocument {
  const newClasses = new Map(doc.netClasses);
  newClasses.set(netClass.id, netClass);
  return touchSchematicDocument({ ...doc, netClasses: newClasses });
}

/**
 * Set the linked PCB path.
 */
export function setLinkedPcb(
  doc: SchematicDocument,
  path: string | undefined
): SchematicDocument {
  return touchSchematicDocument({ ...doc, linkedPcbPath: path });
}

/**
 * Rename the document.
 */
export function renameSchematicDocument(
  doc: SchematicDocument,
  name: string
): SchematicDocument {
  return touchSchematicDocument({ ...doc, name });
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all symbol instances.
 */
export function getAllInstances(doc: SchematicDocument): SymbolInstance[] {
  return Array.from(doc.symbolInstances.values());
}

/**
 * Get all wires.
 */
export function getAllWires(doc: SchematicDocument): Wire[] {
  return Array.from(doc.wires.values());
}

/**
 * Get all net labels.
 */
export function getAllLabels(doc: SchematicDocument): NetLabel[] {
  return Array.from(doc.netLabels.values());
}

/**
 * Get all junctions.
 */
export function getAllJunctions(doc: SchematicDocument): Junction[] {
  return Array.from(doc.junctions.values());
}

/**
 * Get all ports.
 */
export function getAllPorts(doc: SchematicDocument): Port[] {
  return Array.from(doc.ports.values());
}

/**
 * Get the next available reference designator.
 */
export function getNextRefDes(doc: SchematicDocument, prefix: string): string {
  let maxNum = 0;
  const regex = new RegExp(`^${prefix}(\\d+)$`);

  for (const instance of doc.symbolInstances.values()) {
    const match = instance.refDes.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `${prefix}${maxNum + 1}`;
}

/**
 * Find instance by reference designator.
 */
export function findInstanceByRefDes(
  doc: SchematicDocument,
  refDes: string
): SymbolInstance | undefined {
  for (const instance of doc.symbolInstances.values()) {
    if (instance.refDes === refDes) {
      return instance;
    }
  }
  return undefined;
}

/**
 * Get all unique net names.
 */
export function getNetNames(doc: SchematicDocument): string[] {
  return Array.from(doc.nets.values()).map((n) => n.name);
}

// ============================================================================
// Legacy API compatibility
// ============================================================================

/**
 * @deprecated Use getAllInstances instead. Kept for backward compatibility.
 */
export function getActiveSheetInstances(doc: SchematicDocument): SymbolInstance[] {
  return getAllInstances(doc);
}

/**
 * @deprecated Use getAllWires instead. Kept for backward compatibility.
 */
export function getActiveSheetWires(doc: SchematicDocument): Wire[] {
  return getAllWires(doc);
}

/**
 * @deprecated Use getAllLabels instead. Kept for backward compatibility.
 */
export function getActiveSheetLabels(doc: SchematicDocument): NetLabel[] {
  return getAllLabels(doc);
}
