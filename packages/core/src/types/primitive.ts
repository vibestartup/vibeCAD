/**
 * Sketch primitives - the basic geometric elements that make up a sketch.
 */

import { PrimitiveId } from "./id";

/** Base interface for all sketch primitives */
interface PrimitiveBase {
  id: PrimitiveId;
  /** Construction geometry is used for reference but doesn't form profiles */
  construction: boolean;
}

/** A point in 2D sketch space */
export interface PointPrimitive extends PrimitiveBase {
  type: "point";
  x: number;
  y: number;
}

/** A line segment between two points */
export interface LinePrimitive extends PrimitiveBase {
  type: "line";
  start: PrimitiveId; // Reference to PointPrimitive
  end: PrimitiveId; // Reference to PointPrimitive
}

/** A circular arc defined by center and two endpoints */
export interface ArcPrimitive extends PrimitiveBase {
  type: "arc";
  center: PrimitiveId; // Reference to PointPrimitive
  start: PrimitiveId; // Reference to PointPrimitive
  end: PrimitiveId; // Reference to PointPrimitive
  clockwise: boolean;
}

/** A full circle defined by center point and radius */
export interface CirclePrimitive extends PrimitiveBase {
  type: "circle";
  center: PrimitiveId; // Reference to PointPrimitive
  radius: number;
}

/** A spline curve (B-spline or NURBS) */
export interface SplinePrimitive extends PrimitiveBase {
  type: "spline";
  controlPoints: PrimitiveId[]; // References to PointPrimitives
  degree: number;
  knots?: number[]; // Knot vector for NURBS
  weights?: number[]; // Weights for rational splines
}

/** A rectangle defined by two corner points (convenience primitive) */
export interface RectPrimitive extends PrimitiveBase {
  type: "rect";
  corner1: PrimitiveId; // Reference to PointPrimitive
  corner2: PrimitiveId; // Reference to PointPrimitive
}

/** Union of all primitive types */
export type SketchPrimitive =
  | PointPrimitive
  | LinePrimitive
  | ArcPrimitive
  | CirclePrimitive
  | SplinePrimitive
  | RectPrimitive;

/** Discriminator type for primitives */
export type PrimitiveType = SketchPrimitive["type"];

/** Type guard for point primitives */
export function isPoint(p: SketchPrimitive): p is PointPrimitive {
  return p.type === "point";
}

/** Type guard for line primitives */
export function isLine(p: SketchPrimitive): p is LinePrimitive {
  return p.type === "line";
}

/** Type guard for arc primitives */
export function isArc(p: SketchPrimitive): p is ArcPrimitive {
  return p.type === "arc";
}

/** Type guard for circle primitives */
export function isCircle(p: SketchPrimitive): p is CirclePrimitive {
  return p.type === "circle";
}

/** Type guard for spline primitives */
export function isSpline(p: SketchPrimitive): p is SplinePrimitive {
  return p.type === "spline";
}

/** Type guard for rect primitives */
export function isRect(p: SketchPrimitive): p is RectPrimitive {
  return p.type === "rect";
}

/**
 * Get all point IDs referenced by a primitive.
 */
export function getReferencedPoints(primitive: SketchPrimitive): PrimitiveId[] {
  switch (primitive.type) {
    case "point":
      return [];
    case "line":
      return [primitive.start, primitive.end];
    case "arc":
      return [primitive.center, primitive.start, primitive.end];
    case "circle":
      return [primitive.center];
    case "spline":
      return [...primitive.controlPoints];
    case "rect":
      return [primitive.corner1, primitive.corner2];
  }
}
