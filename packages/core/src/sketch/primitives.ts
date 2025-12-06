/**
 * Sketch primitive operations - add, remove, update primitives.
 */

import {
  PrimitiveId,
  newId,
  Sketch,
  SketchPrimitive,
  PointPrimitive,
  LinePrimitive,
  ArcPrimitive,
  CirclePrimitive,
  getReferencedPoints,
} from "../types";

// ============================================================================
// Add Primitives
// ============================================================================

/**
 * Add a primitive to a sketch.
 */
export function addPrimitive(sketch: Sketch, primitive: SketchPrimitive): Sketch {
  const newPrimitives = new Map(sketch.primitives);
  newPrimitives.set(primitive.id, primitive);
  return {
    ...sketch,
    primitives: newPrimitives,
    // Clear solver output since sketch changed
    solvedPositions: undefined,
    solveStatus: undefined,
    dof: undefined,
  };
}

/**
 * Add a point to a sketch.
 */
export function addPoint(
  sketch: Sketch,
  x: number,
  y: number,
  construction = false
): { sketch: Sketch; pointId: PrimitiveId } {
  const point: PointPrimitive = {
    id: newId("Primitive"),
    type: "point",
    x,
    y,
    construction,
  };
  return {
    sketch: addPrimitive(sketch, point),
    pointId: point.id,
  };
}

/**
 * Add a line to a sketch (creates endpoints if not provided).
 */
export function addLine(
  sketch: Sketch,
  start: PrimitiveId | { x: number; y: number },
  end: PrimitiveId | { x: number; y: number },
  construction = false
): { sketch: Sketch; lineId: PrimitiveId; startId: PrimitiveId; endId: PrimitiveId } {
  let s = sketch;
  let startId: PrimitiveId;
  let endId: PrimitiveId;

  // Handle start point
  if (typeof start === "object" && "x" in start) {
    const result = addPoint(s, start.x, start.y, construction);
    s = result.sketch;
    startId = result.pointId;
  } else {
    startId = start;
  }

  // Handle end point
  if (typeof end === "object" && "x" in end) {
    const result = addPoint(s, end.x, end.y, construction);
    s = result.sketch;
    endId = result.pointId;
  } else {
    endId = end;
  }

  const line: LinePrimitive = {
    id: newId("Primitive"),
    type: "line",
    start: startId,
    end: endId,
    construction,
  };

  return {
    sketch: addPrimitive(s, line),
    lineId: line.id,
    startId,
    endId,
  };
}

/**
 * Add a circle to a sketch.
 */
export function addCircle(
  sketch: Sketch,
  center: PrimitiveId | { x: number; y: number },
  radius: number,
  construction = false
): { sketch: Sketch; circleId: PrimitiveId; centerId: PrimitiveId } {
  let s = sketch;
  let centerId: PrimitiveId;

  if (typeof center === "object" && "x" in center) {
    const result = addPoint(s, center.x, center.y, construction);
    s = result.sketch;
    centerId = result.pointId;
  } else {
    centerId = center;
  }

  const circle: CirclePrimitive = {
    id: newId("Primitive"),
    type: "circle",
    center: centerId,
    radius,
    construction,
  };

  return {
    sketch: addPrimitive(s, circle),
    circleId: circle.id,
    centerId,
  };
}

/**
 * Add an arc to a sketch.
 */
export function addArc(
  sketch: Sketch,
  center: PrimitiveId | { x: number; y: number },
  start: PrimitiveId | { x: number; y: number },
  end: PrimitiveId | { x: number; y: number },
  clockwise = false,
  construction = false
): {
  sketch: Sketch;
  arcId: PrimitiveId;
  centerId: PrimitiveId;
  startId: PrimitiveId;
  endId: PrimitiveId;
} {
  let s = sketch;
  let centerId: PrimitiveId;
  let startId: PrimitiveId;
  let endId: PrimitiveId;

  if (typeof center === "object" && "x" in center) {
    const result = addPoint(s, center.x, center.y, construction);
    s = result.sketch;
    centerId = result.pointId;
  } else {
    centerId = center;
  }

  if (typeof start === "object" && "x" in start) {
    const result = addPoint(s, start.x, start.y, construction);
    s = result.sketch;
    startId = result.pointId;
  } else {
    startId = start;
  }

  if (typeof end === "object" && "x" in end) {
    const result = addPoint(s, end.x, end.y, construction);
    s = result.sketch;
    endId = result.pointId;
  } else {
    endId = end;
  }

  const arc: ArcPrimitive = {
    id: newId("Primitive"),
    type: "arc",
    center: centerId,
    start: startId,
    end: endId,
    clockwise,
    construction,
  };

  return {
    sketch: addPrimitive(s, arc),
    arcId: arc.id,
    centerId,
    startId,
    endId,
  };
}

/**
 * Add a rectangle (4 lines + 4 points).
 */
export function addRectangle(
  sketch: Sketch,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  construction = false
): {
  sketch: Sketch;
  pointIds: [PrimitiveId, PrimitiveId, PrimitiveId, PrimitiveId];
  lineIds: [PrimitiveId, PrimitiveId, PrimitiveId, PrimitiveId];
} {
  let s = sketch;

  // Add 4 corners
  const p1 = addPoint(s, x1, y1, construction);
  s = p1.sketch;
  const p2 = addPoint(s, x2, y1, construction);
  s = p2.sketch;
  const p3 = addPoint(s, x2, y2, construction);
  s = p3.sketch;
  const p4 = addPoint(s, x1, y2, construction);
  s = p4.sketch;

  // Add 4 lines
  const l1 = addLine(s, p1.pointId, p2.pointId, construction);
  s = l1.sketch;
  const l2 = addLine(s, p2.pointId, p3.pointId, construction);
  s = l2.sketch;
  const l3 = addLine(s, p3.pointId, p4.pointId, construction);
  s = l3.sketch;
  const l4 = addLine(s, p4.pointId, p1.pointId, construction);
  s = l4.sketch;

  return {
    sketch: s,
    pointIds: [p1.pointId, p2.pointId, p3.pointId, p4.pointId],
    lineIds: [l1.lineId, l2.lineId, l3.lineId, l4.lineId],
  };
}

// ============================================================================
// Remove Primitives
// ============================================================================

/**
 * Remove a primitive from a sketch.
 * Also removes any constraints referencing it.
 */
export function removePrimitive(sketch: Sketch, primitiveId: PrimitiveId): Sketch {
  const newPrimitives = new Map(sketch.primitives);
  newPrimitives.delete(primitiveId);

  // Remove constraints that reference this primitive
  const newConstraints = new Map(sketch.constraints);
  for (const [cid, constraint] of sketch.constraints) {
    if (constraint.entities.includes(primitiveId)) {
      newConstraints.delete(cid);
    }
  }

  // Also remove primitives that reference this (e.g., lines referencing deleted points)
  for (const [pid, prim] of newPrimitives) {
    const refs = getReferencedPoints(prim);
    if (refs.includes(primitiveId)) {
      newPrimitives.delete(pid);
      // And their constraints
      for (const [cid, constraint] of newConstraints) {
        if (constraint.entities.includes(pid)) {
          newConstraints.delete(cid);
        }
      }
    }
  }

  return {
    ...sketch,
    primitives: newPrimitives,
    constraints: newConstraints,
    solvedPositions: undefined,
    solveStatus: undefined,
    dof: undefined,
  };
}

// ============================================================================
// Update Primitives
// ============================================================================

/**
 * Update a primitive's properties.
 */
export function updatePrimitive(
  sketch: Sketch,
  primitiveId: PrimitiveId,
  updates: Partial<SketchPrimitive>
): Sketch {
  const primitive = sketch.primitives.get(primitiveId);
  if (!primitive) return sketch;

  const newPrimitives = new Map(sketch.primitives);
  newPrimitives.set(primitiveId, { ...primitive, ...updates } as SketchPrimitive);

  return {
    ...sketch,
    primitives: newPrimitives,
    solvedPositions: undefined,
    solveStatus: undefined,
    dof: undefined,
  };
}

/**
 * Move a point to a new position.
 */
export function movePoint(
  sketch: Sketch,
  pointId: PrimitiveId,
  x: number,
  y: number
): Sketch {
  const point = sketch.primitives.get(pointId);
  if (!point || point.type !== "point") return sketch;

  return updatePrimitive(sketch, pointId, { x, y });
}

/**
 * Toggle construction mode for a primitive.
 */
export function toggleConstruction(
  sketch: Sketch,
  primitiveId: PrimitiveId
): Sketch {
  const primitive = sketch.primitives.get(primitiveId);
  if (!primitive) return sketch;

  return updatePrimitive(sketch, primitiveId, {
    construction: !primitive.construction,
  });
}
