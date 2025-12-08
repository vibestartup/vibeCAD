/**
 * Schematic sheets - multi-page schematic support.
 */

import {
  SheetId,
  SymbolInstanceId,
  WireId,
  NetLabelId,
  PortId,
  NetId,
  newId,
} from "../id";
import { SchematicPoint } from "./primitives";

// ============================================================================
// Sheet Symbol (for hierarchical designs)
// ============================================================================

export interface SheetSymbolPin {
  name: string;
  position: SchematicPoint; // Relative to sheet symbol
  netId: NetId;
}

export interface SheetSymbol {
  position: SchematicPoint;
  size: { width: number; height: number };
  pins: SheetSymbolPin[];
}

// ============================================================================
// Sheet
// ============================================================================

export interface Sheet {
  id: SheetId;
  name: string;
  number: number; // Sheet number (1, 2, 3, ...)

  // Content references (IDs of elements on this sheet)
  symbolInstances: Set<SymbolInstanceId>;
  wires: Set<WireId>;
  labels: Set<NetLabelId>;
  ports: Set<PortId>;

  // For hierarchical designs: this sheet's symbol representation
  sheetSymbol?: SheetSymbol;

  // Sheet size (for printing/display)
  size: SheetSize;
}

// ============================================================================
// Sheet Size
// ============================================================================

export type SheetSizeName = "A4" | "A3" | "A2" | "A1" | "A0" | "Letter" | "Legal" | "Tabloid" | "Custom";

export interface SheetSize {
  name: SheetSizeName;
  width: number; // mm
  height: number; // mm
  landscape: boolean;
}

// Standard sheet sizes
export const SHEET_SIZES: Record<SheetSizeName, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Tabloid: { width: 279.4, height: 431.8 },
  Custom: { width: 297, height: 210 },
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new sheet.
 */
export function createSheet(name: string, number: number): Sheet {
  return {
    id: newId("Sheet"),
    name,
    number,
    symbolInstances: new Set(),
    wires: new Set(),
    labels: new Set(),
    ports: new Set(),
    size: createSheetSize("A4", true),
  };
}

/**
 * Create a sheet size.
 */
export function createSheetSize(
  name: SheetSizeName,
  landscape: boolean = true
): SheetSize {
  const base = SHEET_SIZES[name];
  return {
    name,
    width: landscape ? Math.max(base.width, base.height) : Math.min(base.width, base.height),
    height: landscape ? Math.min(base.width, base.height) : Math.max(base.width, base.height),
    landscape,
  };
}

/**
 * Create a custom sheet size.
 */
export function createCustomSheetSize(
  width: number,
  height: number
): SheetSize {
  return {
    name: "Custom",
    width,
    height,
    landscape: width > height,
  };
}

// ============================================================================
// Sheet Operations (Immutable)
// ============================================================================

/**
 * Add a symbol instance to a sheet.
 */
export function addInstanceToSheet(sheet: Sheet, instanceId: SymbolInstanceId): Sheet {
  const newInstances = new Set(sheet.symbolInstances);
  newInstances.add(instanceId);
  return { ...sheet, symbolInstances: newInstances };
}

/**
 * Remove a symbol instance from a sheet.
 */
export function removeInstanceFromSheet(sheet: Sheet, instanceId: SymbolInstanceId): Sheet {
  const newInstances = new Set(sheet.symbolInstances);
  newInstances.delete(instanceId);
  return { ...sheet, symbolInstances: newInstances };
}

/**
 * Add a wire to a sheet.
 */
export function addWireToSheet(sheet: Sheet, wireId: WireId): Sheet {
  const newWires = new Set(sheet.wires);
  newWires.add(wireId);
  return { ...sheet, wires: newWires };
}

/**
 * Remove a wire from a sheet.
 */
export function removeWireFromSheet(sheet: Sheet, wireId: WireId): Sheet {
  const newWires = new Set(sheet.wires);
  newWires.delete(wireId);
  return { ...sheet, wires: newWires };
}

/**
 * Add a label to a sheet.
 */
export function addLabelToSheet(sheet: Sheet, labelId: NetLabelId): Sheet {
  const newLabels = new Set(sheet.labels);
  newLabels.add(labelId);
  return { ...sheet, labels: newLabels };
}

/**
 * Remove a label from a sheet.
 */
export function removeLabelFromSheet(sheet: Sheet, labelId: NetLabelId): Sheet {
  const newLabels = new Set(sheet.labels);
  newLabels.delete(labelId);
  return { ...sheet, labels: newLabels };
}

/**
 * Add a port to a sheet.
 */
export function addPortToSheet(sheet: Sheet, portId: PortId): Sheet {
  const newPorts = new Set(sheet.ports);
  newPorts.add(portId);
  return { ...sheet, ports: newPorts };
}

/**
 * Remove a port from a sheet.
 */
export function removePortFromSheet(sheet: Sheet, portId: PortId): Sheet {
  const newPorts = new Set(sheet.ports);
  newPorts.delete(portId);
  return { ...sheet, ports: newPorts };
}

/**
 * Set the sheet size.
 */
export function setSheetSize(sheet: Sheet, size: SheetSize): Sheet {
  return { ...sheet, size };
}

/**
 * Rename a sheet.
 */
export function renameSheet(sheet: Sheet, name: string): Sheet {
  return { ...sheet, name };
}

/**
 * Set sheet number.
 */
export function setSheetNumber(sheet: Sheet, number: number): Sheet {
  return { ...sheet, number };
}
