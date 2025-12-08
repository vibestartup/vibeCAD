/**
 * Operations module - evaluate CAD operations.
 *
 * Note: Actual kernel calls happen in @vibecad/kernel.
 * This module provides the evaluation context and dispatch logic.
 */

import {
  Op,
  OpId,
  OpResult,
  PartStudio,
  ParamEnv,
  TopoRef,
  Vec3,
  vec3,
} from "../types";

// ============================================================================
// Evaluation Context
// ============================================================================

/**
 * Context passed to operation evaluators.
 * The actual kernel APIs are injected at runtime.
 */
export interface EvalContext {
  /** OpenCascade API */
  occ: OccApi;
  /** Geometric Constraint Solver API (PlaneGCS) */
  gcs: GcsApi;
  /** Global parameters */
  params: ParamEnv;
  /** Current part studio state */
  studio: PartStudio;
  /** Results of previously evaluated operations */
  results: Map<OpId, OpResult>;
}

/**
 * Minimal OCC API interface (implemented in @vibecad/kernel).
 */
export interface OccApi {
  makePolygon(points: Vec3[]): number;
  makeWire(edges: number[]): number;
  makeFace(wire: number): number;
  extrude(face: number, direction: Vec3, depth: number): number;
  revolve(face: number, axisOrigin: Vec3, axisDir: Vec3, angleRad: number): number;
  fuse(a: number, b: number): number;
  cut(a: number, b: number): number;
  intersect(a: number, b: number): number;
  fillet(shape: number, edges: number[], radius: number): number;
  chamfer(shape: number, edges: number[], distance: number): number;
  getFaces(shape: number): number[];
  getEdges(shape: number): number[];
  getVertices(shape: number): number[];
  faceCenter(face: number): Vec3;
  faceNormal(face: number): Vec3;
  faceArea(face: number): number;
  edgeMidpoint(edge: number): Vec3;
  edgeLength(edge: number): number;
  mesh(shape: number, deflection: number): {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
  };
  freeShape(shape: number): void;
}

/**
 * GCS API interface (implemented in @vibecad/kernel via PlaneGCS).
 * Full interface required by sketch constraint solver.
 */
export interface GcsApi {
  createGroup(): number;
  freeGroup(groupId: number): void;
  // Primitives
  addPoint2d(groupId: number, x: number, y: number): number;
  getPoint2d(pointId: number): { x: number; y: number };
  addLine2d(groupId: number, p1: number, p2: number): number;
  addCircle2d(groupId: number, center: number, radius: number): number;
  addArc2d(groupId: number, center: number, start: number, end: number): number;
  // Geometric constraints
  addCoincident(groupId: number, p1: number, p2: number): number;
  addHorizontal(groupId: number, line: number): number;
  addVertical(groupId: number, line: number): number;
  addParallel(groupId: number, l1: number, l2: number): number;
  addPerpendicular(groupId: number, l1: number, l2: number): number;
  addTangent(groupId: number, e1: number, e2: number): number;
  addEqual(groupId: number, e1: number, e2: number): number;
  addPointOnLine(groupId: number, pt: number, line: number): number;
  addMidpoint(groupId: number, pt: number, line: number): number;
  // Dimensional constraints
  addDistance(groupId: number, p1: number, p2: number, dist: number): number;
  addAngle(groupId: number, l1: number, l2: number, angleRad: number): number;
  addRadius(groupId: number, circle: number, radius: number): number;
  addHorizontalDistance(groupId: number, p1: number, p2: number, dist: number): number;
  addVerticalDistance(groupId: number, p1: number, p2: number, dist: number): number;
  // Solve
  solve(groupId: number): {
    ok: boolean;
    dof: number;
    status: string;
  };
}

// ============================================================================
// TopoRef Resolution
// ============================================================================

/**
 * Resolve a topological reference to an OCC handle.
 */
export function resolveTopoRef(
  ref: TopoRef,
  results: Map<OpId, OpResult>,
  occ: OccApi
): number | undefined {
  const result = results.get(ref.opId);
  if (!result) return undefined;

  const map = result.topoMap;
  let handles: number[];

  switch (ref.subType) {
    case "face":
      handles = occ.getFaces(result.shapeHandle);
      break;
    case "edge":
      handles = occ.getEdges(result.shapeHandle);
      break;
    case "vertex":
      handles = occ.getVertices(result.shapeHandle);
      break;
  }

  // Direct index lookup
  if (ref.index >= 0 && ref.index < handles.length) {
    return handles[ref.index];
  }

  // Fall back to signature matching if available
  if (ref.signature && handles.length > 0) {
    return matchBySignature(ref, handles, occ);
  }

  return undefined;
}

/**
 * Match a TopoRef by geometric signature.
 */
function matchBySignature(
  ref: TopoRef,
  handles: number[],
  occ: OccApi
): number | undefined {
  const sig = ref.signature!;
  let bestMatch: number | undefined;
  let bestScore = Infinity;

  for (const handle of handles) {
    let score = 0;

    if (ref.subType === "face") {
      if (sig.center) {
        const center = occ.faceCenter(handle);
        score += vec3.distanceSq(center, sig.center);
      }
      if (sig.normal) {
        const normal = occ.faceNormal(handle);
        score += (1 - Math.abs(vec3.dot(normal, sig.normal))) * 100;
      }
      if (sig.area !== undefined) {
        const area = occ.faceArea(handle);
        score += Math.abs(area - sig.area);
      }
    } else if (ref.subType === "edge") {
      if (sig.center) {
        const mid = occ.edgeMidpoint(handle);
        score += vec3.distanceSq(mid, sig.center);
      }
      if (sig.length !== undefined) {
        const len = occ.edgeLength(handle);
        score += Math.abs(len - sig.length);
      }
    }

    if (score < bestScore) {
      bestScore = score;
      bestMatch = handle;
    }
  }

  return bestMatch;
}

/**
 * Build a TopoRef with signature for a face.
 */
export function buildFaceRef(
  opId: OpId,
  index: number,
  handle: number,
  occ: OccApi
): TopoRef {
  return {
    opId,
    subType: "face",
    index,
    signature: {
      center: occ.faceCenter(handle),
      normal: occ.faceNormal(handle),
      area: occ.faceArea(handle),
    },
  };
}

/**
 * Build a TopoRef with signature for an edge.
 */
export function buildEdgeRef(
  opId: OpId,
  index: number,
  handle: number,
  occ: OccApi
): TopoRef {
  return {
    opId,
    subType: "edge",
    index,
    signature: {
      center: occ.edgeMidpoint(handle),
      length: occ.edgeLength(handle),
    },
  };
}

// ============================================================================
// Operation Result Building
// ============================================================================

/**
 * Build an OpResult from a shape handle.
 */
export function buildOpResult(
  opId: OpId,
  shapeHandle: number,
  occ: OccApi,
  meshDeflection = 0.1
): OpResult {
  const faces = occ.getFaces(shapeHandle);
  const edges = occ.getEdges(shapeHandle);
  const vertices = occ.getVertices(shapeHandle);

  return {
    shapeHandle,
    mesh: occ.mesh(shapeHandle, meshDeflection),
    topoMap: {
      faces: faces.map((h, i) => buildFaceRef(opId, i, h, occ)),
      edges: edges.map((h, i) => buildEdgeRef(opId, i, h, occ)),
      vertices: vertices.map((_, i) => ({
        opId,
        subType: "vertex" as const,
        index: i,
      })),
    },
  };
}

// ============================================================================
// Registry Export
// ============================================================================

export {
  opRegistry,
  registerOp,
  createEvalContext,
  type OpEvalContext,
  type OpEvaluator,
} from "./registry";
