/**
 * Operation Registry - pluggable operation evaluation system.
 *
 * This allows operations to be registered and evaluated dynamically,
 * making the system extensible for custom operations.
 */

import {
  Op,
  OpType,
  OpId,
  OpResult,
  PartStudio,
  ParamEnv,
  Sketch,
  SketchPlane,
} from "../types";
import type { OccApi, SlvsApi } from "./index";

// ============================================================================
// Evaluation Context
// ============================================================================

/**
 * Context passed to operation evaluators.
 */
export interface OpEvalContext {
  /** OpenCascade API */
  occ: OccApi;
  /** SolveSpace API */
  slvs: SlvsApi;
  /** Global parameters */
  params: ParamEnv;
  /** Current part studio */
  studio: PartStudio;
  /** Results of previously evaluated operations */
  results: Map<OpId, OpResult>;

  // Convenience accessors
  getSketch(sketchId: string): Sketch | undefined;
  getPlane(planeId: string): SketchPlane | undefined;
  getResult(opId: OpId): OpResult | undefined;
}

/**
 * Create an evaluation context.
 */
export function createEvalContext(
  occ: OccApi,
  slvs: SlvsApi,
  params: ParamEnv,
  studio: PartStudio,
  results: Map<OpId, OpResult>
): OpEvalContext {
  return {
    occ,
    slvs,
    params,
    studio,
    results,
    getSketch: (id) => studio.sketches.get(id as any),
    getPlane: (id) => studio.planes.get(id as any),
    getResult: (id) => results.get(id),
  };
}

// ============================================================================
// Operation Evaluator Type
// ============================================================================

/**
 * An operation evaluator function.
 * Takes an operation and context, returns a result (or null for ops that don't produce geometry).
 */
export type OpEvaluator<T extends Op = Op> = (
  op: T,
  ctx: OpEvalContext
) => Promise<OpResult | null>;

// ============================================================================
// Operation Registry
// ============================================================================

/**
 * Registry of operation evaluators.
 */
class OperationRegistry {
  private evaluators = new Map<OpType, OpEvaluator<any>>();
  private validators = new Map<OpType, (op: Op) => string | null>();
  private metadata = new Map<
    OpType,
    {
      name: string;
      description: string;
      category: "sketch" | "primary" | "secondary";
      icon?: string;
    }
  >();

  /**
   * Register an operation evaluator.
   */
  register<T extends Op>(
    type: T["type"],
    evaluator: OpEvaluator<T>,
    meta?: {
      name?: string;
      description?: string;
      category?: "sketch" | "primary" | "secondary";
      icon?: string;
      validator?: (op: T) => string | null;
    }
  ): void {
    this.evaluators.set(type, evaluator as OpEvaluator<any>);

    if (meta?.validator) {
      this.validators.set(type, meta.validator as (op: Op) => string | null);
    }

    this.metadata.set(type, {
      name: meta?.name ?? type,
      description: meta?.description ?? "",
      category: meta?.category ?? "secondary",
      icon: meta?.icon,
    });
  }

  /**
   * Get an evaluator for an operation type.
   */
  getEvaluator(type: OpType): OpEvaluator | undefined {
    return this.evaluators.get(type);
  }

  /**
   * Evaluate an operation.
   */
  async evaluate(op: Op, ctx: OpEvalContext): Promise<OpResult | null> {
    const evaluator = this.evaluators.get(op.type);
    if (!evaluator) {
      throw new Error(`No evaluator registered for operation type: ${op.type}`);
    }
    return evaluator(op, ctx);
  }

  /**
   * Validate an operation.
   */
  validate(op: Op): string | null {
    const validator = this.validators.get(op.type);
    if (validator) {
      return validator(op);
    }
    return null;
  }

  /**
   * Get metadata for an operation type.
   */
  getMetadata(type: OpType) {
    return this.metadata.get(type);
  }

  /**
   * Get all registered operation types.
   */
  getRegisteredTypes(): OpType[] {
    return Array.from(this.evaluators.keys());
  }

  /**
   * Check if an operation type is registered.
   */
  isRegistered(type: OpType): boolean {
    return this.evaluators.has(type);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const opRegistry = new OperationRegistry();

// ============================================================================
// Registration Helpers
// ============================================================================

/**
 * Decorator-style registration for operation evaluators.
 */
export function registerOp<T extends Op>(
  type: T["type"],
  meta?: {
    name?: string;
    description?: string;
    category?: "sketch" | "primary" | "secondary";
    icon?: string;
  }
) {
  return function (evaluator: OpEvaluator<T>) {
    opRegistry.register(type, evaluator, meta);
    return evaluator;
  };
}

// ============================================================================
// Built-in Operation Registrations
// ============================================================================

// These will be registered when the module loads

import { evalDimValue } from "../params";
import { sketchToWorld, findClosedLoops, getLoopPoints } from "../sketch";
import { buildOpResult, resolveTopoRef } from "./index";

// Sketch operation (doesn't produce geometry)
opRegistry.register(
  "sketch",
  async (_op, _ctx) => null,
  {
    name: "Sketch",
    description: "2D sketch on a plane",
    category: "sketch",
    icon: "pencil",
  }
);

// Extrude operation
opRegistry.register(
  "extrude",
  async (op, ctx) => {
    const sketch = ctx.getSketch(op.sketchId);
    if (!sketch) throw new Error(`Sketch not found: ${op.sketchId}`);

    const plane = ctx.getPlane(sketch.planeId);
    if (!plane) throw new Error(`Plane not found: ${sketch.planeId}`);

    const loops = findClosedLoops(sketch);
    if (loops.length === 0) {
      throw new Error("No closed profiles found in sketch");
    }

    const loop = loops[0];
    const points2d = getLoopPoints(sketch, loop);
    const points3d = points2d.map((p) => sketchToWorld(p, plane));

    const wire = ctx.occ.makePolygon(points3d);
    const face = ctx.occ.makeFace(wire);

    // Compute normal
    const nx = plane.axisX[1] * plane.axisY[2] - plane.axisX[2] * plane.axisY[1];
    const ny = plane.axisX[2] * plane.axisY[0] - plane.axisX[0] * plane.axisY[2];
    const nz = plane.axisX[0] * plane.axisY[1] - plane.axisX[1] * plane.axisY[0];
    const planeNormal: [number, number, number] = [nx, ny, nz];

    let direction = planeNormal;
    if (op.direction === "reverse") {
      direction = [-nx, -ny, -nz];
    }

    const depth = evalDimValue(op.depth, ctx.params);

    let shape: number;
    if (op.direction === "symmetric") {
      const half = depth / 2;
      const pos = ctx.occ.extrude(face, planeNormal, half);
      const neg = ctx.occ.extrude(face, [-nx, -ny, -nz], half);
      shape = ctx.occ.fuse(pos, neg);
    } else {
      shape = ctx.occ.extrude(face, direction, depth);
    }

    return buildOpResult(op.id, shape, ctx.occ);
  },
  {
    name: "Extrude",
    description: "Extrude a sketch profile along its normal",
    category: "primary",
    icon: "arrow-up",
  }
);

// Boolean operation
opRegistry.register(
  "boolean",
  async (op, ctx) => {
    const targetResult = ctx.getResult(op.targetOp);
    const toolResult = ctx.getResult(op.toolOp);

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
  },
  {
    name: "Boolean",
    description: "Combine shapes with union, subtract, or intersect",
    category: "secondary",
    icon: "layers",
  }
);

// Fillet operation
opRegistry.register(
  "fillet",
  async (op, ctx) => {
    const targetResult = ctx.getResult(op.targetOp);
    if (!targetResult) throw new Error(`Target operation not found: ${op.targetOp}`);

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
  },
  {
    name: "Fillet",
    description: "Round edges with a specified radius",
    category: "secondary",
    icon: "corner-round",
  }
);

// Chamfer operation
opRegistry.register(
  "chamfer",
  async (op, ctx) => {
    const targetResult = ctx.getResult(op.targetOp);
    if (!targetResult) throw new Error(`Target operation not found: ${op.targetOp}`);

    const edgeHandles: number[] = [];
    for (const edgeRef of op.edges) {
      const handle = resolveTopoRef(edgeRef, ctx.results, ctx.occ);
      if (handle !== undefined) {
        edgeHandles.push(handle);
      }
    }

    if (edgeHandles.length === 0) {
      throw new Error("No valid edges found for chamfer");
    }

    const distance = evalDimValue(op.distance, ctx.params);
    const shape = ctx.occ.chamfer(targetResult.shapeHandle, edgeHandles, distance);

    return buildOpResult(op.id, shape, ctx.occ);
  },
  {
    name: "Chamfer",
    description: "Bevel edges with a specified distance",
    category: "secondary",
    icon: "corner-square",
  }
);
