/**
 * Schematic symbols - reusable component representations.
 */

import {
  SymbolId,
  PinId,
  ComponentId,
  ComponentLibraryId,
  newId,
} from "../id";
import { SchematicPoint, SymbolPrimitive } from "./primitives";

// ============================================================================
// Pin Types
// ============================================================================

/**
 * Electrical type of a pin - affects ERC (Electrical Rule Check).
 */
export type PinType =
  | "input" // Input pin
  | "output" // Output pin
  | "bidirectional" // Bidirectional I/O
  | "tristate" // Tri-state output
  | "passive" // Passive component (resistor, capacitor)
  | "power_in" // Power input (VCC, VDD)
  | "power_out" // Power output (regulator output)
  | "open_collector" // Open collector/drain
  | "open_emitter" // Open emitter/source
  | "not_connected"; // No internal connection

/**
 * Visual shape of a pin.
 */
export type PinShape =
  | "line" // Simple line
  | "inverted" // Circle (active low)
  | "clock" // Clock input triangle
  | "inverted_clock" // Clock with inversion bubble
  | "input_low" // Active low input
  | "output_low" // Active low output
  | "edge_clock_high" // Edge-triggered clock
  | "non_logic"; // Non-logic (analog)

/**
 * Pin orientation relative to symbol body.
 */
export type PinOrientation = "left" | "right" | "up" | "down";

// ============================================================================
// Symbol Pin
// ============================================================================

export interface SymbolPin {
  id: PinId;
  name: string;
  number: string; // Pin number (can be alphanumeric, e.g., "A1", "VCC")
  position: SchematicPoint; // Relative to symbol origin
  orientation: PinOrientation;
  length: number; // Visual length of pin line
  type: PinType;
  shape: PinShape;
  hidden: boolean; // Hidden pins (e.g., power pins on ICs)
  nameVisible: boolean;
  numberVisible: boolean;
}

// ============================================================================
// Symbol
// ============================================================================

export interface SymbolBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Symbol {
  id: SymbolId;
  name: string;
  description: string;

  // Graphics
  primitives: SymbolPrimitive[];
  pins: Map<PinId, SymbolPin>;

  // Bounding box (computed from primitives)
  bounds: SymbolBounds;

  // Reference designator prefix (e.g., "R" for resistors, "U" for ICs)
  refDesPrefix: string;

  // Whether this symbol can be mirrored
  allowMirror: boolean;

  // For multi-unit symbols (e.g., quad op-amp)
  unitCount: number;
  unitSwappable: boolean; // Can units be swapped in layout?

  // Library reference
  libraryId?: ComponentLibraryId;
  componentId?: ComponentId;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new empty symbol.
 */
export function createSymbol(name: string, refDesPrefix: string): Symbol {
  return {
    id: newId("Symbol"),
    name,
    description: "",
    primitives: [],
    pins: new Map(),
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    refDesPrefix,
    allowMirror: true,
    unitCount: 1,
    unitSwappable: false,
  };
}

/**
 * Create a new pin.
 */
export function createPin(
  name: string,
  number: string,
  position: SchematicPoint,
  orientation: PinOrientation,
  type: PinType = "passive"
): SymbolPin {
  return {
    id: newId("Pin"),
    name,
    number,
    position,
    orientation,
    length: 100, // Default 100mil
    type,
    shape: "line",
    hidden: false,
    nameVisible: true,
    numberVisible: true,
  };
}

/**
 * Calculate bounds from symbol primitives.
 */
export function calculateSymbolBounds(symbol: Symbol): SymbolBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Include primitives
  for (const prim of symbol.primitives) {
    switch (prim.type) {
      case "line":
        minX = Math.min(minX, prim.start.x, prim.end.x);
        minY = Math.min(minY, prim.start.y, prim.end.y);
        maxX = Math.max(maxX, prim.start.x, prim.end.x);
        maxY = Math.max(maxY, prim.start.y, prim.end.y);
        break;
      case "rect":
        minX = Math.min(minX, prim.corner1.x, prim.corner2.x);
        minY = Math.min(minY, prim.corner1.y, prim.corner2.y);
        maxX = Math.max(maxX, prim.corner1.x, prim.corner2.x);
        maxY = Math.max(maxY, prim.corner1.y, prim.corner2.y);
        break;
      case "circle":
        minX = Math.min(minX, prim.center.x - prim.radius);
        minY = Math.min(minY, prim.center.y - prim.radius);
        maxX = Math.max(maxX, prim.center.x + prim.radius);
        maxY = Math.max(maxY, prim.center.y + prim.radius);
        break;
      case "arc":
        // Approximate with circle bounds
        minX = Math.min(minX, prim.center.x - prim.radius);
        minY = Math.min(minY, prim.center.y - prim.radius);
        maxX = Math.max(maxX, prim.center.x + prim.radius);
        maxY = Math.max(maxY, prim.center.y + prim.radius);
        break;
      case "polyline":
        for (const pt of prim.points) {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        }
        break;
      case "text":
        // Text bounds are approximate
        minX = Math.min(minX, prim.position.x);
        minY = Math.min(minY, prim.position.y - prim.fontSize);
        maxX = Math.max(maxX, prim.position.x + prim.text.length * prim.fontSize * 0.6);
        maxY = Math.max(maxY, prim.position.y);
        break;
    }
  }

  // Include pins
  for (const pin of symbol.pins.values()) {
    minX = Math.min(minX, pin.position.x);
    minY = Math.min(minY, pin.position.y);
    maxX = Math.max(maxX, pin.position.x);
    maxY = Math.max(maxY, pin.position.y);
  }

  // Handle empty symbol
  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Add a pin to a symbol (immutable).
 */
export function addPinToSymbol(symbol: Symbol, pin: SymbolPin): Symbol {
  const newPins = new Map(symbol.pins);
  newPins.set(pin.id, pin);
  const updated = { ...symbol, pins: newPins };
  return { ...updated, bounds: calculateSymbolBounds(updated) };
}

/**
 * Add a primitive to a symbol (immutable).
 */
export function addPrimitiveToSymbol(symbol: Symbol, primitive: SymbolPrimitive): Symbol {
  const updated = { ...symbol, primitives: [...symbol.primitives, primitive] };
  return { ...updated, bounds: calculateSymbolBounds(updated) };
}

// ============================================================================
// Built-in Symbol Generators
// ============================================================================

/**
 * Create a basic resistor symbol.
 */
export function createResistorSymbol(): Symbol {
  const sym = createSymbol("Resistor", "R");

  // Body (zigzag simplified as rectangle for now)
  sym.primitives = [
    { type: "rect", corner1: { x: -30, y: -10 }, corner2: { x: 30, y: 10 }, fill: false, width: 2 },
  ];

  // Pins
  const pin1 = createPin("1", "1", { x: -50, y: 0 }, "right", "passive");
  const pin2 = createPin("2", "2", { x: 50, y: 0 }, "left", "passive");
  sym.pins.set(pin1.id, pin1);
  sym.pins.set(pin2.id, pin2);

  sym.bounds = calculateSymbolBounds(sym);
  return sym;
}

/**
 * Create a basic capacitor symbol.
 */
export function createCapacitorSymbol(): Symbol {
  const sym = createSymbol("Capacitor", "C");

  // Two parallel lines
  sym.primitives = [
    { type: "line", start: { x: -5, y: -20 }, end: { x: -5, y: 20 }, width: 2 },
    { type: "line", start: { x: 5, y: -20 }, end: { x: 5, y: 20 }, width: 2 },
  ];

  // Pins
  const pin1 = createPin("1", "1", { x: -30, y: 0 }, "right", "passive");
  const pin2 = createPin("2", "2", { x: 30, y: 0 }, "left", "passive");
  sym.pins.set(pin1.id, pin1);
  sym.pins.set(pin2.id, pin2);

  sym.bounds = calculateSymbolBounds(sym);
  return sym;
}

/**
 * Create a basic LED symbol.
 */
export function createLedSymbol(): Symbol {
  const sym = createSymbol("LED", "D");

  // Triangle (anode to cathode)
  sym.primitives = [
    { type: "polyline", points: [{ x: -10, y: -15 }, { x: -10, y: 15 }, { x: 15, y: 0 }, { x: -10, y: -15 }], width: 2, fill: false },
    // Cathode bar
    { type: "line", start: { x: 15, y: -15 }, end: { x: 15, y: 15 }, width: 2 },
    // Arrows (light emission)
    { type: "line", start: { x: 5, y: -20 }, end: { x: 15, y: -30 }, width: 1 },
    { type: "line", start: { x: 10, y: -15 }, end: { x: 20, y: -25 }, width: 1 },
  ];

  // Pins
  const anode = createPin("A", "1", { x: -30, y: 0 }, "right", "passive");
  const cathode = createPin("K", "2", { x: 40, y: 0 }, "left", "passive");
  sym.pins.set(anode.id, anode);
  sym.pins.set(cathode.id, cathode);

  sym.bounds = calculateSymbolBounds(sym);
  return sym;
}

/**
 * Create a basic NPN transistor symbol.
 */
export function createNpnSymbol(): Symbol {
  const sym = createSymbol("NPN", "Q");

  // Base line and emitter/collector
  sym.primitives = [
    // Base vertical line
    { type: "line", start: { x: 0, y: -20 }, end: { x: 0, y: 20 }, width: 2 },
    // Base horizontal line
    { type: "line", start: { x: -20, y: 0 }, end: { x: 0, y: 0 }, width: 2 },
    // Collector line
    { type: "line", start: { x: 0, y: -10 }, end: { x: 20, y: -25 }, width: 2 },
    // Emitter line
    { type: "line", start: { x: 0, y: 10 }, end: { x: 20, y: 25 }, width: 2 },
    // Emitter arrow (pointing outward)
    { type: "polyline", points: [{ x: 12, y: 22 }, { x: 20, y: 25 }, { x: 17, y: 15 }], width: 2, fill: true },
  ];

  // Pins
  const base = createPin("B", "1", { x: -40, y: 0 }, "right", "input");
  const collector = createPin("C", "2", { x: 20, y: -45 }, "down", "output");
  const emitter = createPin("E", "3", { x: 20, y: 45 }, "up", "output");
  sym.pins.set(base.id, base);
  sym.pins.set(collector.id, collector);
  sym.pins.set(emitter.id, emitter);

  sym.bounds = calculateSymbolBounds(sym);
  return sym;
}

/**
 * Create a ground symbol.
 */
export function createGroundSymbol(): Symbol {
  const sym = createSymbol("GND", "GND");
  sym.refDesPrefix = "#PWR";

  sym.primitives = [
    { type: "line", start: { x: 0, y: 0 }, end: { x: 0, y: 20 }, width: 2 },
    { type: "line", start: { x: -20, y: 20 }, end: { x: 20, y: 20 }, width: 2 },
    { type: "line", start: { x: -12, y: 27 }, end: { x: 12, y: 27 }, width: 2 },
    { type: "line", start: { x: -5, y: 34 }, end: { x: 5, y: 34 }, width: 2 },
  ];

  const pin = createPin("GND", "1", { x: 0, y: -20 }, "down", "power_in");
  pin.hidden = false;
  sym.pins.set(pin.id, pin);

  sym.bounds = calculateSymbolBounds(sym);
  return sym;
}

/**
 * Create a VCC power symbol.
 */
export function createVccSymbol(): Symbol {
  const sym = createSymbol("VCC", "VCC");
  sym.refDesPrefix = "#PWR";

  sym.primitives = [
    { type: "line", start: { x: 0, y: 0 }, end: { x: 0, y: -20 }, width: 2 },
    { type: "line", start: { x: -15, y: -20 }, end: { x: 0, y: -35 }, width: 2 },
    { type: "line", start: { x: 15, y: -20 }, end: { x: 0, y: -35 }, width: 2 },
  ];

  const pin = createPin("VCC", "1", { x: 0, y: 20 }, "up", "power_in");
  pin.hidden = false;
  sym.pins.set(pin.id, pin);

  sym.bounds = calculateSymbolBounds(sym);
  return sym;
}

/**
 * Create a basic inductor symbol.
 */
export function createInductorSymbol(): Symbol {
  const sym = createSymbol("Inductor", "L");

  // Inductor coils (arcs approximated with lines for simplicity)
  sym.primitives = [
    // Four humps for the coil
    { type: "arc", center: { x: -22, y: 0 }, radius: 8, startAngle: 0, endAngle: 180, width: 2 },
    { type: "arc", center: { x: -8, y: 0 }, radius: 8, startAngle: 0, endAngle: 180, width: 2 },
    { type: "arc", center: { x: 6, y: 0 }, radius: 8, startAngle: 0, endAngle: 180, width: 2 },
    { type: "arc", center: { x: 20, y: 0 }, radius: 8, startAngle: 0, endAngle: 180, width: 2 },
  ];

  // Pins
  const pin1 = createPin("1", "1", { x: -50, y: 0 }, "right", "passive");
  const pin2 = createPin("2", "2", { x: 50, y: 0 }, "left", "passive");
  sym.pins.set(pin1.id, pin1);
  sym.pins.set(pin2.id, pin2);

  sym.bounds = calculateSymbolBounds(sym);
  return sym;
}

/**
 * Create a basic diode symbol.
 */
export function createDiodeSymbol(): Symbol {
  const sym = createSymbol("Diode", "D");

  // Triangle (anode to cathode)
  sym.primitives = [
    { type: "polyline", points: [{ x: -10, y: -15 }, { x: -10, y: 15 }, { x: 15, y: 0 }, { x: -10, y: -15 }], width: 2, fill: false },
    // Cathode bar
    { type: "line", start: { x: 15, y: -15 }, end: { x: 15, y: 15 }, width: 2 },
  ];

  // Pins
  const anode = createPin("A", "1", { x: -30, y: 0 }, "right", "passive");
  const cathode = createPin("K", "2", { x: 40, y: 0 }, "left", "passive");
  sym.pins.set(anode.id, anode);
  sym.pins.set(cathode.id, cathode);

  sym.bounds = calculateSymbolBounds(sym);
  return sym;
}
