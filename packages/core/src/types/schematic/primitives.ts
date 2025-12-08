/**
 * Schematic primitives - graphical elements used in symbols and drawings.
 */

// ============================================================================
// Base Types
// ============================================================================

export interface SchematicPoint {
  x: number; // Grid units (typically 100mil = 2.54mm grid)
  y: number;
}

export type TextJustify =
  | "left"
  | "center"
  | "right"
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

// ============================================================================
// Symbol Primitives (graphics that make up a symbol)
// ============================================================================

export interface LinePrimitive {
  type: "line";
  start: SchematicPoint;
  end: SchematicPoint;
  width: number;
}

export interface RectPrimitive {
  type: "rect";
  corner1: SchematicPoint;
  corner2: SchematicPoint;
  fill: boolean;
  width: number;
}

export interface CirclePrimitive {
  type: "circle";
  center: SchematicPoint;
  radius: number;
  fill: boolean;
  width: number;
}

export interface ArcPrimitive {
  type: "arc";
  center: SchematicPoint;
  radius: number;
  startAngle: number; // Radians
  endAngle: number; // Radians
  width: number;
}

export interface PolylinePrimitive {
  type: "polyline";
  points: SchematicPoint[];
  width: number;
  fill: boolean;
}

export interface TextPrimitive {
  type: "text";
  position: SchematicPoint;
  text: string;
  fontSize: number;
  justify: TextJustify;
  rotation?: number;
}

export type SymbolPrimitive =
  | LinePrimitive
  | RectPrimitive
  | CirclePrimitive
  | ArcPrimitive
  | PolylinePrimitive
  | TextPrimitive;

// ============================================================================
// Type Guards
// ============================================================================

export function isLinePrimitive(p: SymbolPrimitive): p is LinePrimitive {
  return p.type === "line";
}

export function isRectPrimitive(p: SymbolPrimitive): p is RectPrimitive {
  return p.type === "rect";
}

export function isCirclePrimitive(p: SymbolPrimitive): p is CirclePrimitive {
  return p.type === "circle";
}

export function isArcPrimitive(p: SymbolPrimitive): p is ArcPrimitive {
  return p.type === "arc";
}

export function isPolylinePrimitive(p: SymbolPrimitive): p is PolylinePrimitive {
  return p.type === "polyline";
}

export function isTextPrimitive(p: SymbolPrimitive): p is TextPrimitive {
  return p.type === "text";
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create a point at the given coordinates.
 */
export function point(x: number, y: number): SchematicPoint {
  return { x, y };
}

/**
 * Calculate distance between two points.
 */
export function distance(a: SchematicPoint, b: SchematicPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate midpoint between two points.
 */
export function midpoint(a: SchematicPoint, b: SchematicPoint): SchematicPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

/**
 * Snap a point to the nearest grid position.
 */
export function snapToGrid(p: SchematicPoint, gridSize: number): SchematicPoint {
  return {
    x: Math.round(p.x / gridSize) * gridSize,
    y: Math.round(p.y / gridSize) * gridSize,
  };
}

/**
 * Rotate a point around an origin.
 */
export function rotatePoint(
  p: SchematicPoint,
  origin: SchematicPoint,
  angleDeg: number
): SchematicPoint {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Mirror a point across the Y axis relative to an origin.
 */
export function mirrorPointX(p: SchematicPoint, originX: number): SchematicPoint {
  return {
    x: 2 * originX - p.x,
    y: p.y,
  };
}
