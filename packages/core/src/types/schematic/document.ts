/**
 * Schematic Document - top-level container for a schematic design.
 */

import {
  SchematicDocId,
  SheetId,
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
import { Sheet, createSheet } from "./sheet";

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

  // Multi-sheet support
  sheets: Map<SheetId, Sheet>;
  activeSheetId: SheetId;

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
  const sheet = createSheet("Sheet 1", 1);

  return {
    id: newId("SchematicDoc"),
    name,
    sheets: new Map([[sheet.id, sheet]]),
    activeSheetId: sheet.id,
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
 * Set the active sheet.
 */
export function setActiveSheet(
  doc: SchematicDocument,
  sheetId: SheetId
): SchematicDocument {
  if (!doc.sheets.has(sheetId)) {
    return doc;
  }
  return touchSchematicDocument({ ...doc, activeSheetId: sheetId });
}

/**
 * Add a new sheet.
 */
export function addSheet(doc: SchematicDocument, sheet: Sheet): SchematicDocument {
  const newSheets = new Map(doc.sheets);
  newSheets.set(sheet.id, sheet);
  return touchSchematicDocument({ ...doc, sheets: newSheets });
}

/**
 * Update a sheet.
 */
export function updateSheet(doc: SchematicDocument, sheet: Sheet): SchematicDocument {
  if (!doc.sheets.has(sheet.id)) {
    return doc;
  }
  const newSheets = new Map(doc.sheets);
  newSheets.set(sheet.id, sheet);
  return touchSchematicDocument({ ...doc, sheets: newSheets });
}

/**
 * Delete a sheet.
 */
export function deleteSheet(doc: SchematicDocument, sheetId: SheetId): SchematicDocument {
  if (doc.sheets.size <= 1) {
    return doc; // Cannot delete last sheet
  }

  const sheet = doc.sheets.get(sheetId);
  if (!sheet) {
    return doc;
  }

  // Remove all elements on this sheet
  let updatedDoc = { ...doc };

  // Remove instances
  const newInstances = new Map(doc.symbolInstances);
  for (const instanceId of sheet.symbolInstances) {
    newInstances.delete(instanceId);
  }
  updatedDoc.symbolInstances = newInstances;

  // Remove wires
  const newWires = new Map(doc.wires);
  for (const wireId of sheet.wires) {
    newWires.delete(wireId);
  }
  updatedDoc.wires = newWires;

  // Remove labels
  const newLabels = new Map(doc.netLabels);
  for (const labelId of sheet.labels) {
    newLabels.delete(labelId);
  }
  updatedDoc.netLabels = newLabels;

  // Remove ports
  const newPorts = new Map(doc.ports);
  for (const portId of sheet.ports) {
    newPorts.delete(portId);
  }
  updatedDoc.ports = newPorts;

  // Remove sheet
  const newSheets = new Map(doc.sheets);
  newSheets.delete(sheetId);
  updatedDoc.sheets = newSheets;

  // Update active sheet if needed
  if (updatedDoc.activeSheetId === sheetId) {
    updatedDoc.activeSheetId = newSheets.keys().next().value!;
  }

  return touchSchematicDocument(updatedDoc);
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

  // Add to sheet
  const sheet = doc.sheets.get(instance.sheetId);
  if (sheet) {
    const newSheetInstances = new Set(sheet.symbolInstances);
    newSheetInstances.add(instance.id);
    const newSheets = new Map(doc.sheets);
    newSheets.set(sheet.id, { ...sheet, symbolInstances: newSheetInstances });
    return touchSchematicDocument({
      ...doc,
      symbolInstances: newInstances,
      sheets: newSheets,
    });
  }

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
  const instance = doc.symbolInstances.get(instanceId);
  if (!instance) {
    return doc;
  }

  const newInstances = new Map(doc.symbolInstances);
  newInstances.delete(instanceId);

  // Remove from sheet
  const sheet = doc.sheets.get(instance.sheetId);
  if (sheet) {
    const newSheetInstances = new Set(sheet.symbolInstances);
    newSheetInstances.delete(instanceId);
    const newSheets = new Map(doc.sheets);
    newSheets.set(sheet.id, { ...sheet, symbolInstances: newSheetInstances });
    return touchSchematicDocument({
      ...doc,
      symbolInstances: newInstances,
      sheets: newSheets,
    });
  }

  return touchSchematicDocument({ ...doc, symbolInstances: newInstances });
}

/**
 * Add a wire.
 */
export function addWire(doc: SchematicDocument, wire: Wire): SchematicDocument {
  const newWires = new Map(doc.wires);
  newWires.set(wire.id, wire);

  // Add to sheet
  const sheet = doc.sheets.get(wire.sheetId);
  if (sheet) {
    const newSheetWires = new Set(sheet.wires);
    newSheetWires.add(wire.id);
    const newSheets = new Map(doc.sheets);
    newSheets.set(sheet.id, { ...sheet, wires: newSheetWires });
    return touchSchematicDocument({
      ...doc,
      wires: newWires,
      sheets: newSheets,
    });
  }

  return touchSchematicDocument({ ...doc, wires: newWires });
}

/**
 * Delete a wire.
 */
export function deleteWire(doc: SchematicDocument, wireId: WireId): SchematicDocument {
  const wire = doc.wires.get(wireId);
  if (!wire) {
    return doc;
  }

  const newWires = new Map(doc.wires);
  newWires.delete(wireId);

  // Remove from sheet
  const sheet = doc.sheets.get(wire.sheetId);
  if (sheet) {
    const newSheetWires = new Set(sheet.wires);
    newSheetWires.delete(wireId);
    const newSheets = new Map(doc.sheets);
    newSheets.set(sheet.id, { ...sheet, wires: newSheetWires });
    return touchSchematicDocument({
      ...doc,
      wires: newWires,
      sheets: newSheets,
    });
  }

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
 * Add a net label.
 */
export function addNetLabel(
  doc: SchematicDocument,
  label: NetLabel
): SchematicDocument {
  const newLabels = new Map(doc.netLabels);
  newLabels.set(label.id, label);

  // Add to sheet
  const sheet = doc.sheets.get(label.sheetId);
  if (sheet) {
    const newSheetLabels = new Set(sheet.labels);
    newSheetLabels.add(label.id);
    const newSheets = new Map(doc.sheets);
    newSheets.set(sheet.id, { ...sheet, labels: newSheetLabels });
    return touchSchematicDocument({
      ...doc,
      netLabels: newLabels,
      sheets: newSheets,
    });
  }

  return touchSchematicDocument({ ...doc, netLabels: newLabels });
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
 * Get all instances on the active sheet.
 */
export function getActiveSheetInstances(
  doc: SchematicDocument
): SymbolInstance[] {
  const sheet = doc.sheets.get(doc.activeSheetId);
  if (!sheet) return [];

  return Array.from(sheet.symbolInstances)
    .map((id) => doc.symbolInstances.get(id))
    .filter((inst): inst is SymbolInstance => inst !== undefined);
}

/**
 * Get all wires on the active sheet.
 */
export function getActiveSheetWires(doc: SchematicDocument): Wire[] {
  const sheet = doc.sheets.get(doc.activeSheetId);
  if (!sheet) return [];

  return Array.from(sheet.wires)
    .map((id) => doc.wires.get(id))
    .filter((wire): wire is Wire => wire !== undefined);
}

/**
 * Get all labels on the active sheet.
 */
export function getActiveSheetLabels(doc: SchematicDocument): NetLabel[] {
  const sheet = doc.sheets.get(doc.activeSheetId);
  if (!sheet) return [];

  return Array.from(sheet.labels)
    .map((id) => doc.netLabels.get(id))
    .filter((label): label is NetLabel => label !== undefined);
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
