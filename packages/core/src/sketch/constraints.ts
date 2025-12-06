/**
 * Sketch constraint operations - add, remove, update constraints.
 */

import {
  ConstraintId,
  PrimitiveId,
  newId,
  Sketch,
  SketchConstraint,
  DimValue,
  CoincidentConstraint,
  HorizontalConstraint,
  VerticalConstraint,
  ParallelConstraint,
  PerpendicularConstraint,
  DistanceConstraint,
  AngleConstraint,
  RadiusConstraint,
  EqualConstraint,
  FixedConstraint,
  dimLiteral,
  isDimensionalConstraint,
} from "../types";

// ============================================================================
// Add Constraint (generic)
// ============================================================================

/**
 * Add a constraint to a sketch.
 */
export function addConstraint(
  sketch: Sketch,
  constraint: SketchConstraint
): Sketch {
  const newConstraints = new Map(sketch.constraints);
  newConstraints.set(constraint.id, constraint);
  return {
    ...sketch,
    constraints: newConstraints,
    solvedPositions: undefined,
    solveStatus: undefined,
    dof: undefined,
  };
}

// ============================================================================
// Geometric Constraints
// ============================================================================

/**
 * Add a coincident constraint between two points or point-on-curve.
 */
export function addCoincident(
  sketch: Sketch,
  entity1: PrimitiveId,
  entity2: PrimitiveId
): { sketch: Sketch; constraintId: ConstraintId } {
  const constraint: CoincidentConstraint = {
    id: newId("Constraint"),
    type: "coincident",
    entities: [entity1, entity2],
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

/**
 * Add a horizontal constraint to a line or two points.
 */
export function addHorizontal(
  sketch: Sketch,
  ...entities: PrimitiveId[]
): { sketch: Sketch; constraintId: ConstraintId } {
  const constraint: HorizontalConstraint = {
    id: newId("Constraint"),
    type: "horizontal",
    entities,
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

/**
 * Add a vertical constraint to a line or two points.
 */
export function addVertical(
  sketch: Sketch,
  ...entities: PrimitiveId[]
): { sketch: Sketch; constraintId: ConstraintId } {
  const constraint: VerticalConstraint = {
    id: newId("Constraint"),
    type: "vertical",
    entities,
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

/**
 * Add a parallel constraint between two lines.
 */
export function addParallel(
  sketch: Sketch,
  line1: PrimitiveId,
  line2: PrimitiveId
): { sketch: Sketch; constraintId: ConstraintId } {
  const constraint: ParallelConstraint = {
    id: newId("Constraint"),
    type: "parallel",
    entities: [line1, line2],
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

/**
 * Add a perpendicular constraint between two lines.
 */
export function addPerpendicular(
  sketch: Sketch,
  line1: PrimitiveId,
  line2: PrimitiveId
): { sketch: Sketch; constraintId: ConstraintId } {
  const constraint: PerpendicularConstraint = {
    id: newId("Constraint"),
    type: "perpendicular",
    entities: [line1, line2],
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

/**
 * Add an equal constraint between two entities.
 */
export function addEqual(
  sketch: Sketch,
  entity1: PrimitiveId,
  entity2: PrimitiveId
): { sketch: Sketch; constraintId: ConstraintId } {
  const constraint: EqualConstraint = {
    id: newId("Constraint"),
    type: "equal",
    entities: [entity1, entity2],
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

/**
 * Add a fixed constraint to lock an entity's position.
 */
export function addFixed(
  sketch: Sketch,
  entity: PrimitiveId
): { sketch: Sketch; constraintId: ConstraintId } {
  const constraint: FixedConstraint = {
    id: newId("Constraint"),
    type: "fixed",
    entities: [entity],
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

// ============================================================================
// Dimensional Constraints
// ============================================================================

/**
 * Add a distance constraint.
 */
export function addDistance(
  sketch: Sketch,
  entity1: PrimitiveId,
  entity2: PrimitiveId | undefined,
  value: number | DimValue
): { sketch: Sketch; constraintId: ConstraintId } {
  const dim = typeof value === "number" ? dimLiteral(value) : value;
  const constraint: DistanceConstraint = {
    id: newId("Constraint"),
    type: "distance",
    entities: entity2 ? [entity1, entity2] : [entity1],
    dim,
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

/**
 * Add an angle constraint between two lines.
 */
export function addAngle(
  sketch: Sketch,
  line1: PrimitiveId,
  line2: PrimitiveId,
  value: number | DimValue
): { sketch: Sketch; constraintId: ConstraintId } {
  const dim = typeof value === "number" ? dimLiteral(value) : value;
  const constraint: AngleConstraint = {
    id: newId("Constraint"),
    type: "angle",
    entities: [line1, line2],
    dim,
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

/**
 * Add a radius constraint to an arc or circle.
 */
export function addRadius(
  sketch: Sketch,
  entity: PrimitiveId,
  value: number | DimValue
): { sketch: Sketch; constraintId: ConstraintId } {
  const dim = typeof value === "number" ? dimLiteral(value) : value;
  const constraint: RadiusConstraint = {
    id: newId("Constraint"),
    type: "radius",
    entities: [entity],
    dim,
  };
  return {
    sketch: addConstraint(sketch, constraint),
    constraintId: constraint.id,
  };
}

// ============================================================================
// Remove Constraints
// ============================================================================

/**
 * Remove a constraint from a sketch.
 */
export function removeConstraint(
  sketch: Sketch,
  constraintId: ConstraintId
): Sketch {
  const newConstraints = new Map(sketch.constraints);
  newConstraints.delete(constraintId);
  return {
    ...sketch,
    constraints: newConstraints,
    solvedPositions: undefined,
    solveStatus: undefined,
    dof: undefined,
  };
}

/**
 * Remove all constraints from a sketch.
 */
export function clearConstraints(sketch: Sketch): Sketch {
  return {
    ...sketch,
    constraints: new Map(),
    solvedPositions: undefined,
    solveStatus: undefined,
    dof: undefined,
  };
}

// ============================================================================
// Update Constraints
// ============================================================================

/**
 * Update a dimensional constraint's value.
 */
export function setConstraintDimension(
  sketch: Sketch,
  constraintId: ConstraintId,
  dim: DimValue
): Sketch {
  const constraint = sketch.constraints.get(constraintId);
  if (!constraint || !isDimensionalConstraint(constraint)) {
    return sketch;
  }

  const newConstraints = new Map(sketch.constraints);
  newConstraints.set(constraintId, { ...constraint, dim });

  return {
    ...sketch,
    constraints: newConstraints,
    solvedPositions: undefined,
    solveStatus: undefined,
    dof: undefined,
  };
}

/**
 * Update constraint entities.
 */
export function setConstraintEntities(
  sketch: Sketch,
  constraintId: ConstraintId,
  entities: PrimitiveId[]
): Sketch {
  const constraint = sketch.constraints.get(constraintId);
  if (!constraint) return sketch;

  const newConstraints = new Map(sketch.constraints);
  newConstraints.set(constraintId, { ...constraint, entities });

  return {
    ...sketch,
    constraints: newConstraints,
    solvedPositions: undefined,
    solveStatus: undefined,
    dof: undefined,
  };
}
