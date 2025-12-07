/**
 * Part studio rebuild - evaluate all operations in order.
 */

import {
  PartStudio,
  ParamEnv,
  OpId,
  OpResult,
  Op,
  Sketch,
  SketchId,
} from "../types";
import { evaluateParams, evalDimValue } from "../params";
import { buildOpOrder } from "./graph";
import { EvalContext, OccApi, SlvsApi, buildOpResult } from "../ops";
import { sketchToWorld, findClosedLoops, getLoopPoints } from "../sketch";

// ============================================================================
// Rebuild
// ============================================================================

/**
 * Full rebuild of a part studio.
 * Evaluates all operations in dependency order.
 */
export async function rebuild(
  studio: PartStudio,
  params: ParamEnv,
  occ: OccApi,
  slvs: SlvsApi
): Promise<PartStudio> {
  // Evaluate parameters first
  const evaledParams = evaluateParams(params);

  // Compute operation order
  const opOrder = buildOpOrder(studio.opGraph);

  // Create evaluation context
  const results = new Map<OpId, OpResult>();
  const errors = new Map<OpId, string>();

  const ctx: EvalContext = {
    occ,
    slvs,
    params: evaledParams,
    studio,
    results,
  };

  // Evaluate each operation
  for (const opId of opOrder) {
    const node = studio.opGraph.get(opId);
    if (!node || node.op.suppressed) continue;

    try {
      const result = await evalOp(node.op, ctx);
      if (result) {
        results.set(opId, result);
      }
    } catch (e) {
      errors.set(opId, e instanceof Error ? e.message : String(e));
    }
  }

  return {
    ...studio,
    opOrder,
    results,
    rebuildErrors: errors.size > 0 ? errors : undefined,
  };
}

/**
 * Incremental rebuild starting from a changed operation.
 * Only re-evaluates the changed operation and its dependents.
 */
export async function rebuildFrom(
  studio: PartStudio,
  changedOpId: OpId,
  params: ParamEnv,
  occ: OccApi,
  slvs: SlvsApi
): Promise<PartStudio> {
  // For now, just do a full rebuild
  // Incremental rebuild optimization can be added later
  return rebuild(studio, params, occ, slvs);
}

// ============================================================================
// Operation Evaluation
// ============================================================================

/**
 * Evaluate a single operation.
 */
async function evalOp(op: Op, ctx: EvalContext): Promise<OpResult | null> {
  switch (op.type) {
    case "sketch":
      return evalSketchOp(op, ctx);
    case "extrude":
      return evalExtrudeOp(op, ctx);
    case "revolve":
      return evalRevolveOp(op, ctx);
    case "boolean":
      return evalBooleanOp(op, ctx);
    case "fillet":
      return evalFilletOp(op, ctx);
    default:
      // Other ops not yet implemented
      return null;
  }
}

/**
 * Evaluate a sketch operation.
 * Sketches don't produce geometry, but we solve constraints.
 */
async function evalSketchOp(
  op: Extract<Op, { type: "sketch" }>,
  ctx: EvalContext
): Promise<OpResult | null> {
  // Sketch ops don't produce OCC shapes
  // Constraint solving would happen here via SLVS
  return null;
}

/**
 * Evaluate an extrude operation.
 * Handles both sketch profiles and existing body faces.
 */
async function evalExtrudeOp(
  op: Extract<Op, { type: "extrude" }>,
  ctx: EvalContext
): Promise<OpResult | null> {
  let faceHandle: number;
  let normalDirection: [number, number, number];

  if (op.profile.type === "sketch") {
    // Extrude from sketch profile
    const sketch = ctx.studio.sketches.get(op.profile.sketchId);
    if (!sketch) throw new Error(`Sketch not found: ${op.profile.sketchId}`);

    const plane = ctx.studio.planes.get(sketch.planeId);
    if (!plane) throw new Error(`Plane not found: ${sketch.planeId}`);

    // Find closed loops in the sketch
    const loops = findClosedLoops(sketch);
    if (loops.length === 0) {
      throw new Error("No closed profiles found in sketch");
    }

    // Get the specified profile or first loop
    const profileIndex = op.profile.profileIndices?.[0] ?? 0;
    const loop = loops[profileIndex] ?? loops[0];
    const points2d = getLoopPoints(sketch, loop);
    const points3d = points2d.map((p) => sketchToWorld(p, plane));

    // Create wire and face
    const wire = ctx.occ.makePolygon(points3d);
    faceHandle = ctx.occ.makeFace(wire);

    // Compute plane normal for direction
    const nx = plane.axisX[1] * plane.axisY[2] - plane.axisX[2] * plane.axisY[1];
    const ny = plane.axisX[2] * plane.axisY[0] - plane.axisX[0] * plane.axisY[2];
    const nz = plane.axisX[0] * plane.axisY[1] - plane.axisX[1] * plane.axisY[0];
    normalDirection = [nx, ny, nz];
  } else {
    // Extrude from existing body face
    const sourceResult = ctx.results.get(op.profile.faceRef.opId);
    if (!sourceResult) throw new Error(`Source operation not found: ${op.profile.faceRef.opId}`);

    const faces = ctx.occ.getFaces(sourceResult.shapeHandle);
    if (op.profile.faceRef.index >= faces.length) {
      throw new Error(`Face index ${op.profile.faceRef.index} out of bounds (${faces.length} faces)`);
    }

    faceHandle = faces[op.profile.faceRef.index];

    // Get face normal for direction
    const faceNormal = ctx.occ.faceNormal(faceHandle);
    normalDirection = [faceNormal[0], faceNormal[1], faceNormal[2]];
  }

  const [nx, ny, nz] = normalDirection;
  let direction: [number, number, number] = normalDirection;
  if (op.direction === "reverse") {
    direction = [-nx, -ny, -nz];
  }

  // Get depth
  const depth = evalDimValue(op.depth, ctx.params);

  // Extrude
  let shape: number;
  if (op.direction === "symmetric") {
    const half = depth / 2;
    const pos = ctx.occ.extrude(faceHandle, normalDirection, half);
    const neg = ctx.occ.extrude(faceHandle, [-nx, -ny, -nz], half);
    shape = ctx.occ.fuse(pos, neg);
  } else {
    shape = ctx.occ.extrude(faceHandle, direction, depth);
  }

  return buildOpResult(op.id, shape, ctx.occ);
}

/**
 * Evaluate a revolve operation.
 * Handles both sketch profiles and existing body faces.
 */
async function evalRevolveOp(
  op: Extract<Op, { type: "revolve" }>,
  ctx: EvalContext
): Promise<OpResult | null> {
  let faceHandle: number;

  if (op.profile.type === "sketch") {
    // Revolve from sketch profile
    const sketch = ctx.studio.sketches.get(op.profile.sketchId);
    if (!sketch) throw new Error(`Sketch not found: ${op.profile.sketchId}`);

    const plane = ctx.studio.planes.get(sketch.planeId);
    if (!plane) throw new Error(`Plane not found: ${sketch.planeId}`);

    // Find closed loops
    const loops = findClosedLoops(sketch);
    if (loops.length === 0) {
      throw new Error("No closed profiles found in sketch");
    }

    const profileIndex = op.profile.profileIndices?.[0] ?? 0;
    const loop = loops[profileIndex] ?? loops[0];
    const points2d = getLoopPoints(sketch, loop);
    const points3d = points2d.map((p) => sketchToWorld(p, plane));

    const wire = ctx.occ.makePolygon(points3d);
    faceHandle = ctx.occ.makeFace(wire);
  } else {
    // Revolve from existing body face
    const sourceResult = ctx.results.get(op.profile.faceRef.opId);
    if (!sourceResult) throw new Error(`Source operation not found: ${op.profile.faceRef.opId}`);

    const faces = ctx.occ.getFaces(sourceResult.shapeHandle);
    if (op.profile.faceRef.index >= faces.length) {
      throw new Error(`Face index ${op.profile.faceRef.index} out of bounds (${faces.length} faces)`);
    }

    faceHandle = faces[op.profile.faceRef.index];
  }

  // Get axis
  let axisOrigin: [number, number, number];
  let axisDir: [number, number, number];

  if ("opId" in op.axis) {
    // TopoRef - resolve from previous operation
    throw new Error("TopoRef axis not yet supported");
  } else {
    axisOrigin = op.axis.origin as [number, number, number];
    axisDir = op.axis.direction as [number, number, number];
  }

  const angle = evalDimValue(op.angle, ctx.params);
  const shape = ctx.occ.revolve(faceHandle, axisOrigin, axisDir, angle);

  return buildOpResult(op.id, shape, ctx.occ);
}

/**
 * Evaluate a boolean operation.
 */
async function evalBooleanOp(
  op: Extract<Op, { type: "boolean" }>,
  ctx: EvalContext
): Promise<OpResult | null> {
  const targetResult = ctx.results.get(op.targetOp);
  const toolResult = ctx.results.get(op.toolOp);

  if (!targetResult) throw new Error(`Target operation not found: ${op.targetOp}`);
  if (!toolResult) throw new Error(`Tool operation not found: ${op.toolOp}`);

  let shape: number;
  switch (op.operation) {
    case "union":
      shape = ctx.occ.fuse(targetResult.shapeHandle, toolResult.shapeHandle);
      break;
    case "subtract":
      shape = ctx.occ.cut(targetResult.shapeHandle, toolResult.shapeHandle);
      break;
    case "intersect":
      shape = ctx.occ.intersect(targetResult.shapeHandle, toolResult.shapeHandle);
      break;
  }

  return buildOpResult(op.id, shape, ctx.occ);
}

/**
 * Evaluate a fillet operation.
 */
async function evalFilletOp(
  op: Extract<Op, { type: "fillet" }>,
  ctx: EvalContext
): Promise<OpResult | null> {
  const targetResult = ctx.results.get(op.targetOp);
  if (!targetResult) throw new Error(`Target operation not found: ${op.targetOp}`);

  const { resolveTopoRef } = await import("../ops");
  const edgeHandles: number[] = [];

  for (const edgeRef of op.edges) {
    const handle = resolveTopoRef(edgeRef, ctx.results, ctx.occ);
    if (handle !== undefined) {
      edgeHandles.push(handle);
    }
  }

  if (edgeHandles.length === 0) {
    throw new Error("No valid edges found for fillet");
  }

  const radius = evalDimValue(op.radius, ctx.params);
  const shape = ctx.occ.fillet(targetResult.shapeHandle, edgeHandles, radius);

  return buildOpResult(op.id, shape, ctx.occ);
}
