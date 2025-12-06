/**
 * Sketch constraints - geometric and dimensional relationships between primitives.
 */

import { ConstraintId, ParamId, PrimitiveId } from "./id";

// ============================================================================
// Dimension Value
// ============================================================================

/**
 * A dimensional value that can be:
 * - A literal number
 * - An expression (e.g., "Width * 0.5")
 * - Bound to a parameter
 */
export interface DimValue {
  /** If bound to a global parameter */
  paramId?: ParamId;
  /** Raw expression string (e.g., "10", "Width * 2") */
  expression?: string;
  /** Evaluated numeric value */
  value: number;
}

/**
 * Create a literal dimension value.
 */
export function dimLiteral(value: number): DimValue {
  return { value, expression: String(value) };
}

/**
 * Create a dimension value from an expression.
 */
export function dimExpr(expression: string, value = 0): DimValue {
  return { expression, value };
}

/**
 * Create a dimension value bound to a parameter.
 */
export function dimParam(paramId: ParamId, value = 0): DimValue {
  return { paramId, value };
}

// ============================================================================
// Constraint Base
// ============================================================================

interface ConstraintBase {
  id: ConstraintId;
  /** The primitives this constraint affects */
  entities: PrimitiveId[];
}

// ============================================================================
// Geometric Constraints (no dimension)
// ============================================================================

/** Two points are at the same location, or point on curve */
export interface CoincidentConstraint extends ConstraintBase {
  type: "coincident";
  // entities: [point1, point2] or [point, line/arc/circle]
}

/** A line is horizontal (parallel to X axis) */
export interface HorizontalConstraint extends ConstraintBase {
  type: "horizontal";
  // entities: [line] or [point1, point2]
}

/** A line is vertical (parallel to Y axis) */
export interface VerticalConstraint extends ConstraintBase {
  type: "vertical";
  // entities: [line] or [point1, point2]
}

/** Two lines are parallel */
export interface ParallelConstraint extends ConstraintBase {
  type: "parallel";
  // entities: [line1, line2]
}

/** Two lines are perpendicular */
export interface PerpendicularConstraint extends ConstraintBase {
  type: "perpendicular";
  // entities: [line1, line2]
}

/** A line is tangent to a curve */
export interface TangentConstraint extends ConstraintBase {
  type: "tangent";
  // entities: [line, arc/circle] or [arc, arc]
}

/** Two entities have equal length/radius */
export interface EqualConstraint extends ConstraintBase {
  type: "equal";
  // entities: [line1, line2] or [arc1, arc2] or [circle1, circle2]
}

/** A point or line is fixed in position */
export interface FixedConstraint extends ConstraintBase {
  type: "fixed";
  // entities: [point] or [line]
}

/** Two entities are symmetric about a line */
export interface SymmetricConstraint extends ConstraintBase {
  type: "symmetric";
  // entities: [entity1, entity2, symmetryLine]
}

/** A point lies at the midpoint of a line */
export interface MidpointConstraint extends ConstraintBase {
  type: "midpoint";
  // entities: [point, line]
}

/** A point lies on a line/curve */
export interface PointOnConstraint extends ConstraintBase {
  type: "pointOn";
  // entities: [point, line/arc/circle]
}

// ============================================================================
// Dimensional Constraints
// ============================================================================

/** Distance between two points, or point to line, or line length */
export interface DistanceConstraint extends ConstraintBase {
  type: "distance";
  dim: DimValue;
  // entities: [point1, point2] or [point, line] or [line]
}

/** Angle between two lines */
export interface AngleConstraint extends ConstraintBase {
  type: "angle";
  dim: DimValue; // In radians
  // entities: [line1, line2]
}

/** Radius of an arc or circle */
export interface RadiusConstraint extends ConstraintBase {
  type: "radius";
  dim: DimValue;
  // entities: [arc] or [circle]
}

/** Diameter of an arc or circle */
export interface DiameterConstraint extends ConstraintBase {
  type: "diameter";
  dim: DimValue;
  // entities: [arc] or [circle]
}

/** Horizontal distance between two points */
export interface HorizontalDistanceConstraint extends ConstraintBase {
  type: "horizontalDistance";
  dim: DimValue;
  // entities: [point1, point2]
}

/** Vertical distance between two points */
export interface VerticalDistanceConstraint extends ConstraintBase {
  type: "verticalDistance";
  dim: DimValue;
  // entities: [point1, point2]
}

// ============================================================================
// Union Types
// ============================================================================

export type GeometricConstraint =
  | CoincidentConstraint
  | HorizontalConstraint
  | VerticalConstraint
  | ParallelConstraint
  | PerpendicularConstraint
  | TangentConstraint
  | EqualConstraint
  | FixedConstraint
  | SymmetricConstraint
  | MidpointConstraint
  | PointOnConstraint;

export type DimensionalConstraint =
  | DistanceConstraint
  | AngleConstraint
  | RadiusConstraint
  | DiameterConstraint
  | HorizontalDistanceConstraint
  | VerticalDistanceConstraint;

export type SketchConstraint = GeometricConstraint | DimensionalConstraint;

export type ConstraintType = SketchConstraint["type"];

// ============================================================================
// Type Guards
// ============================================================================

export function isGeometricConstraint(c: SketchConstraint): c is GeometricConstraint {
  return !("dim" in c);
}

export function isDimensionalConstraint(c: SketchConstraint): c is DimensionalConstraint {
  return "dim" in c;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get the expected number of entities for a constraint type.
 */
export function getConstraintArity(type: ConstraintType): { min: number; max: number } {
  switch (type) {
    case "horizontal":
    case "vertical":
    case "fixed":
    case "radius":
    case "diameter":
      return { min: 1, max: 1 };
    case "coincident":
    case "parallel":
    case "perpendicular":
    case "tangent":
    case "equal":
    case "midpoint":
    case "pointOn":
    case "distance":
    case "angle":
    case "horizontalDistance":
    case "verticalDistance":
      return { min: 2, max: 2 };
    case "symmetric":
      return { min: 3, max: 3 };
  }
}
