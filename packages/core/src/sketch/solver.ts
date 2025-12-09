/**
 * Sketch constraint solver - bridges Sketch data model to GcsApi.
 *
 * This module translates our sketch primitives and constraints into
 * GCS (PlaneGCS) entities and constraints, solves, and reads back results.
 */

import {
  Sketch,
  SolveStatus,
  SketchPrimitive,
  SketchConstraint,
  PrimitiveId,
  Vec2,
  isPoint,
  isLine,
  isCircle,
  isArc,
} from "../types";

// GcsApi interface (matches @vibecad/kernel)
interface GcsApi {
  createGroup(): number;
  freeGroup(groupId: number): void;
  addPoint2d(groupId: number, x: number, y: number): number;
  getPoint2d(pointId: number): { x: number; y: number };
  addLine2d(groupId: number, p1: number, p2: number): number;
  addCircle2d(groupId: number, center: number, radius: number): number;
  addArc2d(groupId: number, center: number, start: number, end: number): number;
  addCoincident(groupId: number, p1: number, p2: number): number;
  addHorizontal(groupId: number, line: number): number;
  addVertical(groupId: number, line: number): number;
  addParallel(groupId: number, l1: number, l2: number): number;
  addPerpendicular(groupId: number, l1: number, l2: number): number;
  addTangent(groupId: number, e1: number, e2: number): number;
  addEqual(groupId: number, e1: number, e2: number): number;
  addPointOnLine(groupId: number, pt: number, line: number): number;
  addMidpoint(groupId: number, pt: number, line: number): number;
  addDistance(groupId: number, p1: number, p2: number, dist: number): number;
  addAngle(groupId: number, l1: number, l2: number, angleRad: number): number;
  addRadius(groupId: number, circle: number, radius: number): number;
  addHorizontalDistance(groupId: number, p1: number, p2: number, dist: number): number;
  addVerticalDistance(groupId: number, p1: number, p2: number, dist: number): number;
  solve(groupId: number): { ok: boolean; dof: number; status: string };
}

// ============================================================================
// Result Types
// ============================================================================

export interface SketchSolveResult {
  success: boolean;
  status: SolveStatus;
  dof: number;
  solvedPositions: Map<PrimitiveId, Vec2>;
}

// ============================================================================
// Internal Mapping
// ============================================================================

interface SolverContext {
  groupId: number;
  gcs: GcsApi;
  // Maps our primitive IDs to GCS entity handles
  pointHandles: Map<PrimitiveId, number>;
  lineHandles: Map<PrimitiveId, number>;
  circleHandles: Map<PrimitiveId, number>;
  arcHandles: Map<PrimitiveId, number>;
}

// ============================================================================
// Main Solve Function
// ============================================================================

/**
 * Solve all constraints in a sketch.
 *
 * @param sketch The sketch to solve
 * @param gcs The GCS API instance
 * @returns Solve result with updated positions
 */
export function solveSketch(sketch: Sketch, gcs: GcsApi): SketchSolveResult {
  // Create a new solver group
  const groupId = gcs.createGroup();

  const ctx: SolverContext = {
    groupId,
    gcs,
    pointHandles: new Map(),
    lineHandles: new Map(),
    circleHandles: new Map(),
    arcHandles: new Map(),
  };

  try {
    // Step 1: Add all primitives as GCS entities
    addPrimitivesToSolver(sketch, ctx);

    // Step 2: Add all constraints
    addConstraintsToSolver(sketch, ctx);

    // Step 3: Solve
    const solveResult = gcs.solve(groupId);

    // Step 4: Read back solved positions
    const solvedPositions = readSolvedPositions(sketch, ctx);

    // Map GCS status to our status
    const status = mapSolveStatus(solveResult);

    return {
      success: solveResult.ok,
      status,
      dof: solveResult.dof >= 0 ? solveResult.dof : countDegreesOfFreedom(sketch),
      solvedPositions,
    };
  } finally {
    // Always free the group
    gcs.freeGroup(groupId);
  }
}

// ============================================================================
// Add Primitives
// ============================================================================

function addPrimitivesToSolver(sketch: Sketch, ctx: SolverContext): void {
  const { groupId, gcs, pointHandles, lineHandles, circleHandles, arcHandles } = ctx;

  // First pass: add all points
  for (const [id, prim] of sketch.primitives) {
    if (isPoint(prim)) {
      const handle = gcs.addPoint2d(groupId, prim.x, prim.y);
      pointHandles.set(id, handle);
    }
  }

  // Second pass: add lines, circles, arcs (which reference points)
  for (const [id, prim] of sketch.primitives) {
    if (isLine(prim)) {
      const p1 = pointHandles.get(prim.start);
      const p2 = pointHandles.get(prim.end);
      if (p1 !== undefined && p2 !== undefined) {
        const handle = gcs.addLine2d(groupId, p1, p2);
        lineHandles.set(id, handle);
      }
    } else if (isCircle(prim)) {
      const center = pointHandles.get(prim.center);
      if (center !== undefined) {
        const handle = gcs.addCircle2d(groupId, center, prim.radius);
        circleHandles.set(id, handle);
      }
    } else if (isArc(prim)) {
      const center = pointHandles.get(prim.center);
      const start = pointHandles.get(prim.start);
      const end = pointHandles.get(prim.end);
      if (center !== undefined && start !== undefined && end !== undefined) {
        const handle = gcs.addArc2d(groupId, center, start, end);
        arcHandles.set(id, handle);
      }
    }
  }
}

// ============================================================================
// Add Constraints
// ============================================================================

function addConstraintsToSolver(sketch: Sketch, ctx: SolverContext): void {
  for (const [, constraint] of sketch.constraints) {
    addConstraint(sketch, constraint, ctx);
  }
}

function addConstraint(sketch: Sketch, constraint: SketchConstraint, ctx: SolverContext): void {
  const { groupId, gcs, pointHandles, lineHandles, circleHandles } = ctx;

  // Helper to get entity handle (could be point, line, circle, or arc)
  const getHandle = (id: PrimitiveId): number | undefined => {
    return (
      pointHandles.get(id) ??
      lineHandles.get(id) ??
      circleHandles.get(id) ??
      ctx.arcHandles.get(id)
    );
  };

  // Helper to get point handle specifically
  const getPointHandle = (id: PrimitiveId): number | undefined => {
    // If it's a point, return its handle
    if (pointHandles.has(id)) {
      return pointHandles.get(id);
    }
    // If it's a line, we might need to get one of its endpoints
    // For now, just return undefined if not a point
    return undefined;
  };

  // Helper to get line handle, or create virtual line from two points
  const getLineHandle = (id: PrimitiveId): number | undefined => {
    return lineHandles.get(id);
  };

  switch (constraint.type) {
    case "coincident": {
      const p1 = getPointHandle(constraint.entities[0]);
      const p2 = getPointHandle(constraint.entities[1]);
      if (p1 !== undefined && p2 !== undefined) {
        gcs.addCoincident(groupId, p1, p2);
      }
      break;
    }

    case "horizontal": {
      // Can be a line or two points
      const e = constraint.entities[0];
      const lineHandle = getLineHandle(e);
      if (lineHandle !== undefined) {
        gcs.addHorizontal(groupId, lineHandle);
      } else if (constraint.entities.length === 2) {
        // Two points - create virtual line constraint
        // For now, we'd need to add horizontal distance = 0 constraint
        // This is handled via the line's endpoints being horizontal
        const p1 = getPointHandle(constraint.entities[0]);
        const p2 = getPointHandle(constraint.entities[1]);
        if (p1 !== undefined && p2 !== undefined) {
          // Constrain vertical distance to 0
          gcs.addVerticalDistance(groupId, p1, p2, 0);
        }
      }
      break;
    }

    case "vertical": {
      const e = constraint.entities[0];
      const lineHandle = getLineHandle(e);
      if (lineHandle !== undefined) {
        gcs.addVertical(groupId, lineHandle);
      } else if (constraint.entities.length === 2) {
        const p1 = getPointHandle(constraint.entities[0]);
        const p2 = getPointHandle(constraint.entities[1]);
        if (p1 !== undefined && p2 !== undefined) {
          // Constrain horizontal distance to 0
          gcs.addHorizontalDistance(groupId, p1, p2, 0);
        }
      }
      break;
    }

    case "parallel": {
      const l1 = getLineHandle(constraint.entities[0]);
      const l2 = getLineHandle(constraint.entities[1]);
      if (l1 !== undefined && l2 !== undefined) {
        gcs.addParallel(groupId, l1, l2);
      }
      break;
    }

    case "perpendicular": {
      const l1 = getLineHandle(constraint.entities[0]);
      const l2 = getLineHandle(constraint.entities[1]);
      if (l1 !== undefined && l2 !== undefined) {
        gcs.addPerpendicular(groupId, l1, l2);
      }
      break;
    }

    case "tangent": {
      const e1 = getHandle(constraint.entities[0]);
      const e2 = getHandle(constraint.entities[1]);
      if (e1 !== undefined && e2 !== undefined) {
        gcs.addTangent(groupId, e1, e2);
      }
      break;
    }

    case "equal": {
      const e1 = getHandle(constraint.entities[0]);
      const e2 = getHandle(constraint.entities[1]);
      if (e1 !== undefined && e2 !== undefined) {
        gcs.addEqual(groupId, e1, e2);
      }
      break;
    }

    case "fixed": {
      // Fixed constraint - point stays at current position
      // We implement this by adding distance constraints to origin
      const p = getPointHandle(constraint.entities[0]);
      if (p !== undefined) {
        const prim = sketch.primitives.get(constraint.entities[0]);
        if (prim && isPoint(prim)) {
          // Add fixed X and Y constraints
          // Create a reference point at origin (or use existing)
          const originHandle = gcs.addPoint2d(groupId, 0, 0);
          gcs.addHorizontalDistance(groupId, originHandle, p, prim.x);
          gcs.addVerticalDistance(groupId, originHandle, p, prim.y);
        }
      }
      break;
    }

    case "midpoint": {
      const pt = getPointHandle(constraint.entities[0]);
      const line = getLineHandle(constraint.entities[1]);
      if (pt !== undefined && line !== undefined) {
        gcs.addMidpoint(groupId, pt, line);
      }
      break;
    }

    case "pointOn": {
      const pt = getPointHandle(constraint.entities[0]);
      const curve = getHandle(constraint.entities[1]);
      if (pt !== undefined && curve !== undefined) {
        // Check if it's a line
        if (lineHandles.has(constraint.entities[1])) {
          gcs.addPointOnLine(groupId, pt, curve);
        }
        // For circles/arcs, we'd need addPointOnCircle (not implemented yet)
      }
      break;
    }

    case "distance": {
      if (constraint.entities.length === 2) {
        const p1 = getPointHandle(constraint.entities[0]);
        const p2 = getPointHandle(constraint.entities[1]);
        if (p1 !== undefined && p2 !== undefined) {
          gcs.addDistance(groupId, p1, p2, constraint.dim.value);
        }
      }
      // Single entity (line length) would need special handling
      break;
    }

    case "angle": {
      const l1 = getLineHandle(constraint.entities[0]);
      const l2 = getLineHandle(constraint.entities[1]);
      if (l1 !== undefined && l2 !== undefined) {
        gcs.addAngle(groupId, l1, l2, constraint.dim.value);
      }
      break;
    }

    case "radius": {
      const circle = circleHandles.get(constraint.entities[0]) ?? ctx.arcHandles.get(constraint.entities[0]);
      if (circle !== undefined) {
        gcs.addRadius(groupId, circle, constraint.dim.value);
      }
      break;
    }

    case "diameter": {
      // Diameter is just 2x radius
      const circle = circleHandles.get(constraint.entities[0]) ?? ctx.arcHandles.get(constraint.entities[0]);
      if (circle !== undefined) {
        gcs.addRadius(groupId, circle, constraint.dim.value / 2);
      }
      break;
    }

    case "horizontalDistance": {
      const p1 = getPointHandle(constraint.entities[0]);
      const p2 = getPointHandle(constraint.entities[1]);
      if (p1 !== undefined && p2 !== undefined) {
        gcs.addHorizontalDistance(groupId, p1, p2, constraint.dim.value);
      }
      break;
    }

    case "verticalDistance": {
      const p1 = getPointHandle(constraint.entities[0]);
      const p2 = getPointHandle(constraint.entities[1]);
      if (p1 !== undefined && p2 !== undefined) {
        gcs.addVerticalDistance(groupId, p1, p2, constraint.dim.value);
      }
      break;
    }

    case "symmetric": {
      // Symmetric constraint needs special handling
      // PlaneGCS has p2p_symmetric_ppp but we need the symmetry line
      // For now, skip this constraint type
      console.warn("Symmetric constraint not yet implemented in solver");
      break;
    }
  }
}

// ============================================================================
// Read Results
// ============================================================================

function readSolvedPositions(sketch: Sketch, ctx: SolverContext): Map<PrimitiveId, Vec2> {
  const { gcs, pointHandles } = ctx;
  const positions = new Map<PrimitiveId, Vec2>();

  for (const [primId, handle] of pointHandles) {
    try {
      const pos = gcs.getPoint2d(handle);
      positions.set(primId, [pos.x, pos.y]);
    } catch {
      // If we can't get the position, use original
      const prim = sketch.primitives.get(primId);
      if (prim && isPoint(prim)) {
        positions.set(primId, [prim.x, prim.y]);
      }
    }
  }

  return positions;
}

// ============================================================================
// Utilities
// ============================================================================

function mapSolveStatus(result: { ok: boolean; status: string; dof: number }): SolveStatus {
  if (result.ok) {
    return result.dof === 0 ? "ok" : "under-constrained";
  }

  switch (result.status) {
    case "over":
      return "over-constrained";
    case "inconsistent":
      return "inconsistent";
    default:
      return "error";
  }
}

/**
 * Estimate degrees of freedom for a sketch without solving.
 * Each point has 2 DOF. Constraints remove DOF.
 */
function countDegreesOfFreedom(sketch: Sketch): number {
  let dof = 0;

  // Count points (2 DOF each)
  for (const prim of sketch.primitives.values()) {
    if (isPoint(prim)) {
      dof += 2;
    }
  }

  // Subtract constraints (rough estimate)
  for (const constraint of sketch.constraints.values()) {
    switch (constraint.type) {
      case "coincident":
        dof -= 2; // Removes 2 DOF (x and y)
        break;
      case "horizontal":
      case "vertical":
      case "distance":
      case "radius":
      case "diameter":
      case "horizontalDistance":
      case "verticalDistance":
        dof -= 1;
        break;
      case "parallel":
      case "perpendicular":
      case "angle":
        dof -= 1;
        break;
      case "fixed":
        dof -= 2; // Fixes both x and y
        break;
      case "equal":
        dof -= 1;
        break;
      case "tangent":
        dof -= 1;
        break;
      case "midpoint":
        dof -= 2;
        break;
      case "pointOn":
        dof -= 1;
        break;
      case "symmetric":
        dof -= 2;
        break;
    }
  }

  return Math.max(0, dof);
}

/**
 * Apply solved positions back to a sketch, returning a new sketch.
 */
export function applysolvedPositions(sketch: Sketch, result: SketchSolveResult): Sketch {
  return {
    ...sketch,
    solvedPositions: result.solvedPositions,
    solveStatus: result.status,
    dof: result.dof,
  };
}
