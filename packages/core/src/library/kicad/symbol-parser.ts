/**
 * KiCad Symbol Library Parser (.kicad_sym)
 *
 * Parses KiCad 6/7/8 symbol library files and converts them to vibeCAD Symbol format.
 *
 * KiCad symbol structure:
 * (kicad_symbol_lib
 *   (version N)
 *   (generator "...")
 *   (symbol "name"
 *     (property "Reference" "R" ...)
 *     (property "Value" "R" ...)
 *     (symbol "name_1_1"  ; unit 1, variant 1
 *       (polyline ...)
 *       (rectangle ...)
 *       (circle ...)
 *       (arc ...)
 *       (text ...)
 *       (pin ...)
 *     )
 *   )
 * )
 */

import {
  parseSExpr,
  SExprList,
  findChild,
  findChildren,
  getAtomValue,
  getAtomValues,
  getStringValue,
  getNumberValue,
  getXY,
  getXYAngle,
  getNamedString,
  getNamedNumber,
  hasFlag,
  isList,
} from "./sexpr";
import { Symbol, SymbolPin, PinType, PinShape, PinOrientation, createSymbol, createPin } from "../../types/schematic/symbol";
import { SymbolPrimitive, SchematicPoint, TextJustify } from "../../types/schematic/primitives";
import { newId, SymbolId, PinId } from "../../types/id";

// ============================================================================
// Types
// ============================================================================

export interface KicadSymbolLibrary {
  version: number;
  generator?: string;
  symbols: KicadSymbol[];
}

export interface KicadSymbol {
  name: string;
  extendsSymbol?: string;
  properties: Map<string, KicadProperty>;
  units: KicadSymbolUnit[];
  pinNames?: { offset: number; hide: boolean };
  pinNumbers?: { hide: boolean };
  inBom: boolean;
  onBoard: boolean;
}

export interface KicadProperty {
  name: string;
  value: string;
  position?: { x: number; y: number; angle?: number };
  fontSize?: number;
  hide?: boolean;
}

export interface KicadSymbolUnit {
  unitNumber: number;
  styleNumber: number;
  primitives: KicadPrimitive[];
  pins: KicadPin[];
}

export type KicadPrimitive =
  | KicadPolyline
  | KicadRectangle
  | KicadCircle
  | KicadArc
  | KicadText;

export interface KicadPolyline {
  type: "polyline";
  points: Array<{ x: number; y: number }>;
  strokeWidth: number;
  fillType: "none" | "outline" | "background";
}

export interface KicadRectangle {
  type: "rectangle";
  start: { x: number; y: number };
  end: { x: number; y: number };
  strokeWidth: number;
  fillType: "none" | "outline" | "background";
}

export interface KicadCircle {
  type: "circle";
  center: { x: number; y: number };
  radius: number;
  strokeWidth: number;
  fillType: "none" | "outline" | "background";
}

export interface KicadArc {
  type: "arc";
  start: { x: number; y: number };
  mid: { x: number; y: number };
  end: { x: number; y: number };
  strokeWidth: number;
  fillType: "none" | "outline" | "background";
}

export interface KicadText {
  type: "text";
  text: string;
  position: { x: number; y: number; angle?: number };
  fontSize: number;
}

export interface KicadPin {
  type: KicadPinType;
  shape: KicadPinShape;
  position: { x: number; y: number; angle?: number };
  length: number;
  name: string;
  number: string;
  nameEffects?: { fontSize: number; hide?: boolean };
  numberEffects?: { fontSize: number; hide?: boolean };
}

export type KicadPinType =
  | "input"
  | "output"
  | "bidirectional"
  | "tri_state"
  | "passive"
  | "free"
  | "unspecified"
  | "power_in"
  | "power_out"
  | "open_collector"
  | "open_emitter"
  | "no_connect";

export type KicadPinShape =
  | "line"
  | "inverted"
  | "clock"
  | "inverted_clock"
  | "input_low"
  | "clock_low"
  | "output_low"
  | "edge_clock_high"
  | "non_logic";

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse a KiCad symbol library file.
 */
export function parseKicadSymbolLibrary(content: string): KicadSymbolLibrary {
  const sexpr = parseSExpr(content);

  if (sexpr.tag !== "kicad_symbol_lib") {
    throw new Error(`Expected kicad_symbol_lib, got ${sexpr.tag}`);
  }

  const version = getNamedNumber(sexpr, "version") || 0;
  const generator = getNamedString(sexpr, "generator");

  const symbols: KicadSymbol[] = [];

  for (const symbolExpr of findChildren(sexpr, "symbol")) {
    symbols.push(parseSymbol(symbolExpr));
  }

  return { version, generator, symbols };
}

function parseSymbol(expr: SExprList): KicadSymbol {
  const name = String(getAtomValue(expr) || "");
  const extendsExpr = findChild(expr, "extends");
  const extendsSymbol = extendsExpr ? getStringValue(extendsExpr) : undefined;

  // Properties
  const properties = new Map<string, KicadProperty>();
  for (const propExpr of findChildren(expr, "property")) {
    const prop = parseProperty(propExpr);
    properties.set(prop.name, prop);
  }

  // Pin settings
  const pinNamesExpr = findChild(expr, "pin_names");
  const pinNames = pinNamesExpr
    ? {
        offset: getNamedNumber(pinNamesExpr, "offset") || 0,
        hide: hasFlag(pinNamesExpr, "hide"),
      }
    : undefined;

  const pinNumbersExpr = findChild(expr, "pin_numbers");
  const pinNumbers = pinNumbersExpr
    ? { hide: hasFlag(pinNumbersExpr, "hide") }
    : undefined;

  // Attributes
  const inBom = !hasFlag(expr, "exclude_from_bom");
  const onBoard = !hasFlag(expr, "exclude_from_board");

  // Units (sub-symbols)
  const units: KicadSymbolUnit[] = [];
  for (const unitExpr of findChildren(expr, "symbol")) {
    const unit = parseSymbolUnit(unitExpr);
    if (unit) {
      units.push(unit);
    }
  }

  return {
    name,
    extendsSymbol,
    properties,
    units,
    pinNames,
    pinNumbers,
    inBom,
    onBoard,
  };
}

function parseProperty(expr: SExprList): KicadProperty {
  const values = getAtomValues(expr);
  const name = String(values[0] || "");
  const value = String(values[1] || "");

  const atExpr = findChild(expr, "at");
  const position = atExpr ? getXYAngle(atExpr) : undefined;

  const effectsExpr = findChild(expr, "effects");
  let fontSize: number | undefined;
  let hide = false;

  if (effectsExpr) {
    const fontExpr = findChild(effectsExpr, "font");
    if (fontExpr) {
      const sizeExpr = findChild(fontExpr, "size");
      if (sizeExpr) {
        const sizeValues = getAtomValues(sizeExpr);
        fontSize = typeof sizeValues[0] === "number" ? sizeValues[0] : undefined;
      }
    }
    hide = hasFlag(effectsExpr, "hide");
  }

  return { name, value, position, fontSize, hide };
}

function parseSymbolUnit(expr: SExprList): KicadSymbolUnit | null {
  const name = String(getAtomValue(expr) || "");

  // Extract unit and style numbers from name (e.g., "R_1_1" -> unit 1, style 1)
  const match = name.match(/_(\d+)_(\d+)$/);
  if (!match) {
    // Some symbols have alternate representations without numbers
    return null;
  }

  const unitNumber = parseInt(match[1], 10);
  const styleNumber = parseInt(match[2], 10);

  const primitives: KicadPrimitive[] = [];
  const pins: KicadPin[] = [];

  for (const child of expr.children) {
    if (!isList(child)) continue;

    switch (child.tag) {
      case "polyline":
        primitives.push(parsePolyline(child));
        break;
      case "rectangle":
        primitives.push(parseRectangle(child));
        break;
      case "circle":
        primitives.push(parseCircle(child));
        break;
      case "arc":
        primitives.push(parseArc(child));
        break;
      case "text":
        const text = parseText(child);
        if (text) primitives.push(text);
        break;
      case "pin":
        pins.push(parsePin(child));
        break;
    }
  }

  return { unitNumber, styleNumber, primitives, pins };
}

function parsePolyline(expr: SExprList): KicadPolyline {
  const ptsExpr = findChild(expr, "pts");
  const points: Array<{ x: number; y: number }> = [];

  if (ptsExpr) {
    for (const xyExpr of findChildren(ptsExpr, "xy")) {
      const xy = getXY(xyExpr);
      if (xy) points.push(xy);
    }
  }

  const strokeWidth = getStrokeWidth(expr);
  const fillType = getFillType(expr);

  return { type: "polyline", points, strokeWidth, fillType };
}

function parseRectangle(expr: SExprList): KicadRectangle {
  const startExpr = findChild(expr, "start");
  const endExpr = findChild(expr, "end");

  const start = startExpr ? getXY(startExpr) : { x: 0, y: 0 };
  const end = endExpr ? getXY(endExpr) : { x: 0, y: 0 };

  const strokeWidth = getStrokeWidth(expr);
  const fillType = getFillType(expr);

  return {
    type: "rectangle",
    start: start || { x: 0, y: 0 },
    end: end || { x: 0, y: 0 },
    strokeWidth,
    fillType,
  };
}

function parseCircle(expr: SExprList): KicadCircle {
  const centerExpr = findChild(expr, "center");
  const center = centerExpr ? getXY(centerExpr) : { x: 0, y: 0 };

  const radius = getNamedNumber(expr, "radius") || 0;
  const strokeWidth = getStrokeWidth(expr);
  const fillType = getFillType(expr);

  return {
    type: "circle",
    center: center || { x: 0, y: 0 },
    radius,
    strokeWidth,
    fillType,
  };
}

function parseArc(expr: SExprList): KicadArc {
  const startExpr = findChild(expr, "start");
  const midExpr = findChild(expr, "mid");
  const endExpr = findChild(expr, "end");

  const start = startExpr ? getXY(startExpr) : { x: 0, y: 0 };
  const mid = midExpr ? getXY(midExpr) : { x: 0, y: 0 };
  const end = endExpr ? getXY(endExpr) : { x: 0, y: 0 };

  const strokeWidth = getStrokeWidth(expr);
  const fillType = getFillType(expr);

  return {
    type: "arc",
    start: start || { x: 0, y: 0 },
    mid: mid || { x: 0, y: 0 },
    end: end || { x: 0, y: 0 },
    strokeWidth,
    fillType,
  };
}

function parseText(expr: SExprList): KicadText | null {
  const text = String(getAtomValue(expr) || "");
  if (!text) return null;

  const atExpr = findChild(expr, "at");
  const position = atExpr ? getXYAngle(atExpr) : { x: 0, y: 0 };

  const effectsExpr = findChild(expr, "effects");
  let fontSize = 1.27; // Default KiCad font size

  if (effectsExpr) {
    const fontExpr = findChild(effectsExpr, "font");
    if (fontExpr) {
      const sizeExpr = findChild(fontExpr, "size");
      if (sizeExpr) {
        const sizeValues = getAtomValues(sizeExpr);
        fontSize = typeof sizeValues[0] === "number" ? sizeValues[0] : fontSize;
      }
    }
  }

  return {
    type: "text",
    text,
    position: position || { x: 0, y: 0 },
    fontSize,
  };
}

function parsePin(expr: SExprList): KicadPin {
  const values = getAtomValues(expr);
  const typeStr = String(values[0] || "unspecified");
  const shapeStr = String(values[1] || "line");

  const atExpr = findChild(expr, "at");
  const position = atExpr ? getXYAngle(atExpr) : { x: 0, y: 0 };

  const length = getNamedNumber(expr, "length") || 2.54;

  const nameExpr = findChild(expr, "name");
  const name = nameExpr ? String(getAtomValue(nameExpr) || "") : "";

  const numberExpr = findChild(expr, "number");
  const number = numberExpr ? String(getAtomValue(numberExpr) || "") : "";

  // Name effects
  let nameEffects: { fontSize: number; hide?: boolean } | undefined;
  if (nameExpr) {
    const effectsExpr = findChild(nameExpr, "effects");
    if (effectsExpr) {
      const fontExpr = findChild(effectsExpr, "font");
      if (fontExpr) {
        const sizeExpr = findChild(fontExpr, "size");
        if (sizeExpr) {
          const sizeValues = getAtomValues(sizeExpr);
          nameEffects = {
            fontSize: typeof sizeValues[0] === "number" ? sizeValues[0] : 1.27,
            hide: hasFlag(effectsExpr, "hide"),
          };
        }
      }
    }
  }

  // Number effects
  let numberEffects: { fontSize: number; hide?: boolean } | undefined;
  if (numberExpr) {
    const effectsExpr = findChild(numberExpr, "effects");
    if (effectsExpr) {
      const fontExpr = findChild(effectsExpr, "font");
      if (fontExpr) {
        const sizeExpr = findChild(fontExpr, "size");
        if (sizeExpr) {
          const sizeValues = getAtomValues(sizeExpr);
          numberEffects = {
            fontSize: typeof sizeValues[0] === "number" ? sizeValues[0] : 1.27,
            hide: hasFlag(effectsExpr, "hide"),
          };
        }
      }
    }
  }

  return {
    type: typeStr as KicadPinType,
    shape: shapeStr as KicadPinShape,
    position: position || { x: 0, y: 0 },
    length,
    name,
    number,
    nameEffects,
    numberEffects,
  };
}

function getStrokeWidth(expr: SExprList): number {
  const strokeExpr = findChild(expr, "stroke");
  if (strokeExpr) {
    const width = getNamedNumber(strokeExpr, "width");
    if (width !== undefined) return width;
  }
  return 0.254; // Default KiCad stroke width
}

function getFillType(expr: SExprList): "none" | "outline" | "background" {
  const fillExpr = findChild(expr, "fill");
  if (fillExpr) {
    const typeExpr = findChild(fillExpr, "type");
    if (typeExpr) {
      const type = getStringValue(typeExpr);
      if (type === "outline" || type === "background") {
        return type;
      }
    }
  }
  return "none";
}

// ============================================================================
// Conversion to vibeCAD Format
// ============================================================================

/**
 * Convert KiCad symbols to vibeCAD format.
 */
export function convertKicadSymbolsToVibecad(
  kicadLib: KicadSymbolLibrary
): Symbol[] {
  const symbols: Symbol[] = [];

  for (const kicadSym of kicadLib.symbols) {
    const symbol = convertSymbol(kicadSym);
    if (symbol) {
      symbols.push(symbol);
    }
  }

  return symbols;
}

function convertSymbol(kicadSym: KicadSymbol): Symbol | null {
  // Get reference prefix from Reference property
  const refProp = kicadSym.properties.get("Reference");
  const refDesPrefix = refProp?.value || "U";

  const symbol = createSymbol(kicadSym.name, refDesPrefix);
  symbol.description = kicadSym.properties.get("Description")?.value || "";

  // Use the first unit for the main symbol
  const mainUnit = kicadSym.units.find(u => u.unitNumber === 1 && u.styleNumber === 1);
  if (!mainUnit) {
    // Some symbols might be empty or only have extends
    return null;
  }

  // Convert primitives
  symbol.primitives = mainUnit.primitives.map(convertPrimitive).filter((p): p is SymbolPrimitive => p !== null);

  // Convert pins
  for (const kicadPin of mainUnit.pins) {
    const pin = convertPin(kicadPin, kicadSym);
    symbol.pins.set(pin.id, pin);
  }

  // Set unit count
  const unitNumbers = new Set(kicadSym.units.map(u => u.unitNumber));
  symbol.unitCount = Math.max(...unitNumbers, 1);
  symbol.unitSwappable = symbol.unitCount > 1;

  // Calculate bounds
  symbol.bounds = calculateBounds(symbol);

  return symbol;
}

function convertPrimitive(kicadPrim: KicadPrimitive): SymbolPrimitive | null {
  // KiCad uses mm, vibeCAD uses mils (100mil grid typical)
  // 1mm = ~39.37 mils, but KiCad symbols use ~1.27mm = 50mil grid
  // We'll scale by 39.37 to convert mm to mils (approximately)
  const scale = 39.37;

  switch (kicadPrim.type) {
    case "polyline":
      if (kicadPrim.points.length < 2) return null;
      const points: SchematicPoint[] = kicadPrim.points.map(p => ({
        x: p.x * scale,
        y: -p.y * scale, // Flip Y axis (KiCad Y points down in symbol coords)
      }));
      return {
        type: "polyline",
        points,
        width: Math.max(kicadPrim.strokeWidth * scale, 1),
        fill: kicadPrim.fillType !== "none",
      };

    case "rectangle":
      return {
        type: "rect",
        corner1: { x: kicadPrim.start.x * scale, y: -kicadPrim.start.y * scale },
        corner2: { x: kicadPrim.end.x * scale, y: -kicadPrim.end.y * scale },
        fill: kicadPrim.fillType !== "none",
        width: Math.max(kicadPrim.strokeWidth * scale, 1),
      };

    case "circle":
      return {
        type: "circle",
        center: { x: kicadPrim.center.x * scale, y: -kicadPrim.center.y * scale },
        radius: kicadPrim.radius * scale,
        fill: kicadPrim.fillType !== "none",
        width: Math.max(kicadPrim.strokeWidth * scale, 1),
      };

    case "arc":
      // Convert three-point arc to center/radius/angles
      const arc = calculateArcFromThreePoints(
        kicadPrim.start,
        kicadPrim.mid,
        kicadPrim.end
      );
      if (!arc) return null;
      return {
        type: "arc",
        center: { x: arc.center.x * scale, y: -arc.center.y * scale },
        radius: arc.radius * scale,
        startAngle: -arc.startAngle, // Flip for Y axis
        endAngle: -arc.endAngle,
        width: Math.max(kicadPrim.strokeWidth * scale, 1),
      };

    case "text":
      return {
        type: "text",
        position: { x: kicadPrim.position.x * scale, y: -kicadPrim.position.y * scale },
        text: kicadPrim.text,
        fontSize: kicadPrim.fontSize * scale,
        justify: "center" as TextJustify,
      };

    default:
      return null;
  }
}

function convertPin(kicadPin: KicadPin, kicadSym: KicadSymbol): SymbolPin {
  const scale = 39.37;

  // Convert angle to orientation
  const angle = kicadPin.position.angle || 0;
  let orientation: PinOrientation;
  if (angle === 0) {
    orientation = "right"; // Points right
  } else if (angle === 90) {
    orientation = "up";
  } else if (angle === 180) {
    orientation = "left";
  } else {
    orientation = "down";
  }

  // Convert pin type
  const typeMap: Record<KicadPinType, PinType> = {
    input: "input",
    output: "output",
    bidirectional: "bidirectional",
    tri_state: "tristate",
    passive: "passive",
    free: "passive",
    unspecified: "passive",
    power_in: "power_in",
    power_out: "power_out",
    open_collector: "open_collector",
    open_emitter: "open_emitter",
    no_connect: "not_connected",
  };

  // Convert pin shape
  const shapeMap: Record<KicadPinShape, PinShape> = {
    line: "line",
    inverted: "inverted",
    clock: "clock",
    inverted_clock: "inverted_clock",
    input_low: "input_low",
    clock_low: "clock",
    output_low: "output_low",
    edge_clock_high: "edge_clock_high",
    non_logic: "non_logic",
  };

  const pin = createPin(
    kicadPin.name,
    kicadPin.number,
    { x: kicadPin.position.x * scale, y: -kicadPin.position.y * scale },
    orientation,
    typeMap[kicadPin.type] || "passive"
  );

  pin.length = kicadPin.length * scale;
  pin.shape = shapeMap[kicadPin.shape] || "line";
  pin.nameVisible = !kicadPin.nameEffects?.hide && !kicadSym.pinNames?.hide;
  pin.numberVisible = !kicadPin.numberEffects?.hide && !kicadSym.pinNumbers?.hide;

  return pin;
}

function calculateArcFromThreePoints(
  start: { x: number; y: number },
  mid: { x: number; y: number },
  end: { x: number; y: number }
): { center: { x: number; y: number }; radius: number; startAngle: number; endAngle: number } | null {
  // Calculate circle through three points
  const ax = start.x, ay = start.y;
  const bx = mid.x, by = mid.y;
  const cx = end.x, cy = end.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const radius = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));

  const startAngle = Math.atan2(ay - uy, ax - ux) * 180 / Math.PI;
  const endAngle = Math.atan2(cy - uy, cx - ux) * 180 / Math.PI;

  return {
    center: { x: ux, y: uy },
    radius,
    startAngle,
    endAngle,
  };
}

function calculateBounds(symbol: Symbol): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

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
    }
  }

  for (const pin of symbol.pins.values()) {
    minX = Math.min(minX, pin.position.x);
    minY = Math.min(minY, pin.position.y);
    maxX = Math.max(maxX, pin.position.x);
    maxY = Math.max(maxY, pin.position.y);
  }

  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  return { minX, minY, maxX, maxY };
}
