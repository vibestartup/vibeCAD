/**
 * Sketch - a 2D drawing on a plane containing primitives and constraints.
 */

import { ConstraintId, PrimitiveId, SketchId, SketchPlaneId, newId } from "./id";
import { Vec2 } from "./math";
import { SketchPrimitive } from "./primitive";
import { SketchConstraint } from "./constraint";

// ============================================================================
// Solve Status
// ============================================================================

export type SolveStatus =
  | "ok" // Fully constrained and solved
  | "under-constrained" // Has degrees of freedom remaining
  | "over-constrained" // Too many constraints
  | "inconsistent" // Contradictory constraints
  | "error"; // Solver failed

// ============================================================================
// Sketch
// ============================================================================

export interface Sketch {
  id: SketchId;
  name: string;
  planeId: SketchPlaneId;

  /** All primitives in this sketch, keyed by ID */
  primitives: Map<PrimitiveId, SketchPrimitive>;

  /** All constraints in this sketch, keyed by ID */
  constraints: Map<ConstraintId, SketchConstraint>;

  // === Solver output (populated after solving) ===

  /** Solved positions for point primitives */
  solvedPositions?: Map<PrimitiveId, Vec2>;

  /** Current solve status */
  solveStatus?: SolveStatus;

  /** Degrees of freedom remaining (0 = fully constrained) */
  dof?: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new empty sketch on a plane.
 */
export function createSketch(name: string, planeId: SketchPlaneId): Sketch {
  return {
    id: newId("Sketch"),
    name,
    planeId,
    primitives: new Map(),
    constraints: new Map(),
  };
}

/**
 * Create a deep copy of a sketch.
 */
export function cloneSketch(sketch: Sketch): Sketch {
  return {
    ...sketch,
    id: newId("Sketch"),
    primitives: new Map(sketch.primitives),
    constraints: new Map(sketch.constraints),
    solvedPositions: sketch.solvedPositions
      ? new Map(sketch.solvedPositions)
      : undefined,
  };
}

// ============================================================================
// Accessors
// ============================================================================

/**
 * Get all point primitives in a sketch.
 */
export function getPoints(sketch: Sketch): Map<PrimitiveId, SketchPrimitive> {
  const points = new Map<PrimitiveId, SketchPrimitive>();
  for (const [id, prim] of sketch.primitives) {
    if (prim.type === "point") {
      points.set(id, prim);
    }
  }
  return points;
}

/**
 * Get all non-construction primitives (for profile extraction).
 */
export function getProfilePrimitives(sketch: Sketch): SketchPrimitive[] {
  return Array.from(sketch.primitives.values()).filter((p) => !p.construction);
}

/**
 * Get the solved position of a point, falling back to its original position.
 */
export function getPointPosition(sketch: Sketch, pointId: PrimitiveId): Vec2 | undefined {
  // Check solved positions first
  if (sketch.solvedPositions?.has(pointId)) {
    return sketch.solvedPositions.get(pointId);
  }

  // Fall back to original position
  const point = sketch.primitives.get(pointId);
  if (point?.type === "point") {
    return [point.x, point.y];
  }

  return undefined;
}

/**
 * Check if a sketch is fully constrained.
 */
export function isFullyConstrained(sketch: Sketch): boolean {
  return sketch.solveStatus === "ok" && sketch.dof === 0;
}

/**
 * Get constraints affecting a specific primitive.
 */
export function getConstraintsForPrimitive(
  sketch: Sketch,
  primitiveId: PrimitiveId
): SketchConstraint[] {
  return Array.from(sketch.constraints.values()).filter((c) =>
    c.entities.includes(primitiveId)
  );
}
