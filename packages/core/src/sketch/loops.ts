/**
 * Loop finding algorithm - detect closed loops in sketch geometry.
 */

import {
  PrimitiveId,
  Sketch,
  SketchPrimitive,
  Vec2,
  vec2,
  getPointPosition,
} from "../types";

// ============================================================================
// Types
// ============================================================================

interface Edge {
  id: PrimitiveId;
  start: PrimitiveId;
  end: PrimitiveId;
}

interface Loop {
  /** Primitive IDs forming the loop (in order) */
  primitiveIds: PrimitiveId[];
  /** Point IDs at each vertex of the loop */
  pointIds: PrimitiveId[];
  /** Whether this is an outer loop (CCW) or inner loop (CW) */
  isOuter: boolean;
}

// ============================================================================
// Edge Extraction
// ============================================================================

/**
 * Extract edges from sketch primitives.
 * Circles are treated as closed loops by themselves.
 */
function extractEdges(sketch: Sketch): { edges: Edge[]; circles: PrimitiveId[] } {
  const edges: Edge[] = [];
  const circles: PrimitiveId[] = [];

  for (const [id, prim] of sketch.primitives) {
    if (prim.construction) continue;

    switch (prim.type) {
      case "line":
        edges.push({ id, start: prim.start, end: prim.end });
        break;
      case "arc":
        edges.push({ id, start: prim.start, end: prim.end });
        break;
      case "circle":
        circles.push(id);
        break;
      // Splines, rects handled separately
    }
  }

  return { edges, circles };
}

/**
 * Build adjacency map: point -> [edges touching that point]
 */
function buildAdjacency(edges: Edge[]): Map<PrimitiveId, Edge[]> {
  const adj = new Map<PrimitiveId, Edge[]>();

  for (const edge of edges) {
    if (!adj.has(edge.start)) adj.set(edge.start, []);
    if (!adj.has(edge.end)) adj.set(edge.end, []);
    adj.get(edge.start)!.push(edge);
    adj.get(edge.end)!.push(edge);
  }

  return adj;
}

// ============================================================================
// Loop Finding
// ============================================================================

/**
 * Find all closed loops in a sketch.
 * Returns loops sorted by area (largest first, which is typically the outer boundary).
 */
export function findClosedLoops(sketch: Sketch): Loop[] {
  const { edges, circles } = extractEdges(sketch);
  const loops: Loop[] = [];

  // Each circle is its own closed loop
  for (const circleId of circles) {
    const circle = sketch.primitives.get(circleId);
    if (circle?.type === "circle") {
      loops.push({
        primitiveIds: [circleId],
        pointIds: [circle.center],
        isOuter: true, // Circles are always outer boundaries
      });
    }
  }

  // Find loops from edges
  if (edges.length > 0) {
    const edgeLoops = findEdgeLoops(sketch, edges);
    loops.push(...edgeLoops);
  }

  // Sort by area (largest first)
  return loops.sort((a, b) => {
    const areaA = computeLoopArea(sketch, a);
    const areaB = computeLoopArea(sketch, b);
    return Math.abs(areaB) - Math.abs(areaA);
  });
}

/**
 * Find loops formed by edges using a graph traversal approach.
 */
function findEdgeLoops(sketch: Sketch, edges: Edge[]): Loop[] {
  const adj = buildAdjacency(edges);
  const loops: Loop[] = [];
  const usedEdges = new Set<PrimitiveId>();

  // Try to form loops starting from each edge
  for (const startEdge of edges) {
    if (usedEdges.has(startEdge.id)) continue;

    const loop = traceLoop(sketch, startEdge, adj, usedEdges);
    if (loop) {
      loops.push(loop);
      for (const pid of loop.primitiveIds) {
        usedEdges.add(pid);
      }
    }
  }

  return loops;
}

/**
 * Trace a loop starting from an edge.
 */
function traceLoop(
  sketch: Sketch,
  startEdge: Edge,
  adj: Map<PrimitiveId, Edge[]>,
  usedEdges: Set<PrimitiveId>
): Loop | null {
  const primitiveIds: PrimitiveId[] = [startEdge.id];
  const pointIds: PrimitiveId[] = [startEdge.start];

  let currentPoint = startEdge.end;
  let prevEdge = startEdge;
  const maxIterations = 1000; // Prevent infinite loops
  let iterations = 0;

  while (currentPoint !== startEdge.start && iterations < maxIterations) {
    iterations++;
    pointIds.push(currentPoint);

    // Find next edge
    const candidates = adj.get(currentPoint) || [];
    let nextEdge: Edge | null = null;

    for (const edge of candidates) {
      if (edge.id === prevEdge.id) continue;
      if (usedEdges.has(edge.id) && edge.id !== startEdge.id) continue;

      // Pick the edge that turns most to the left (for CCW loops)
      if (!nextEdge) {
        nextEdge = edge;
      } else {
        // Compare angles to pick leftmost turn
        const currentAngle = getEdgeAngle(sketch, prevEdge, currentPoint);
        const angle1 = getEdgeAngle(sketch, nextEdge, currentPoint);
        const angle2 = getEdgeAngle(sketch, edge, currentPoint);

        const turn1 = normalizeAngle(angle1 - currentAngle);
        const turn2 = normalizeAngle(angle2 - currentAngle);

        if (turn2 < turn1) {
          nextEdge = edge;
        }
      }
    }

    if (!nextEdge) {
      // Dead end, not a closed loop
      return null;
    }

    primitiveIds.push(nextEdge.id);
    currentPoint = nextEdge.start === currentPoint ? nextEdge.end : nextEdge.start;
    prevEdge = nextEdge;
  }

  if (iterations >= maxIterations) {
    return null;
  }

  // Determine if outer or inner loop based on signed area
  const area = computeSignedArea(sketch, pointIds);
  const isOuter = area > 0; // CCW = positive area = outer

  return { primitiveIds, pointIds, isOuter };
}

// ============================================================================
// Geometry Helpers
// ============================================================================

/**
 * Get the angle of an edge at a given point.
 */
function getEdgeAngle(sketch: Sketch, edge: Edge, fromPoint: PrimitiveId): number {
  const from = getPointPosition(sketch, fromPoint);
  const toPoint = edge.start === fromPoint ? edge.end : edge.start;
  const to = getPointPosition(sketch, toPoint);

  if (!from || !to) return 0;

  return Math.atan2(to[1] - from[1], to[0] - from[0]);
}

/**
 * Normalize angle to [0, 2*PI).
 */
function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 2 * Math.PI;
  while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
  return angle;
}

/**
 * Compute signed area of a polygon (positive = CCW).
 */
function computeSignedArea(sketch: Sketch, pointIds: PrimitiveId[]): number {
  let area = 0;
  const n = pointIds.length;

  for (let i = 0; i < n; i++) {
    const p1 = getPointPosition(sketch, pointIds[i]);
    const p2 = getPointPosition(sketch, pointIds[(i + 1) % n]);

    if (p1 && p2) {
      area += p1[0] * p2[1] - p2[0] * p1[1];
    }
  }

  return area / 2;
}

/**
 * Compute the absolute area of a loop.
 */
function computeLoopArea(sketch: Sketch, loop: Loop): number {
  // For circles
  if (loop.primitiveIds.length === 1) {
    const prim = sketch.primitives.get(loop.primitiveIds[0]);
    if (prim?.type === "circle") {
      return Math.PI * prim.radius * prim.radius;
    }
  }

  return Math.abs(computeSignedArea(sketch, loop.pointIds));
}

// ============================================================================
// Profile Extraction
// ============================================================================

/**
 * Get the world coordinates of a loop's vertices.
 */
export function getLoopPoints(sketch: Sketch, loop: Loop): Vec2[] {
  const points: Vec2[] = [];

  for (const pointId of loop.pointIds) {
    const pos = getPointPosition(sketch, pointId);
    if (pos) {
      points.push(pos);
    }
  }

  return points;
}

/**
 * Check if a point is inside a loop.
 */
export function isPointInLoop(sketch: Sketch, loop: Loop, point: Vec2): boolean {
  const vertices = getLoopPoints(sketch, loop);
  if (vertices.length < 3) return false;

  // Ray casting algorithm
  let inside = false;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];

    if (
      vi[1] > point[1] !== vj[1] > point[1] &&
      point[0] < ((vj[0] - vi[0]) * (point[1] - vi[1])) / (vj[1] - vi[1]) + vi[0]
    ) {
      inside = !inside;
    }
  }

  return inside;
}
