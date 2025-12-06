/**
 * Part Studio - contains sketches and operations that define geometry.
 */

import { OpId, PartStudioId, SketchId, SketchPlaneId, newId } from "./id";
import { Vec3 } from "./math";
import { SketchPlane, getDatumPlanes } from "./plane";
import { Sketch } from "./sketch";
import { Op, TopoRef } from "./op";

// ============================================================================
// Mesh Data
// ============================================================================

/** Triangle mesh for rendering */
export interface Mesh {
  /** Vertex positions (xyz xyz xyz...) */
  positions: Float32Array;
  /** Vertex normals (xyz xyz xyz...) */
  normals: Float32Array;
  /** Triangle indices */
  indices: Uint32Array;
}

// ============================================================================
// Operation Graph
// ============================================================================

/** A node in the operation graph */
export interface OpNode {
  op: Op;
  /** Operations this depends on (computed from op references) */
  deps: OpId[];
}

/** Result of evaluating an operation */
export interface OpResult {
  /** Handle to OCC shape (opaque number) */
  shapeHandle: number;
  /** Triangulated mesh for rendering */
  mesh?: Mesh;
  /** Topology map for referencing sub-shapes */
  topoMap: {
    faces: TopoRef[];
    edges: TopoRef[];
    vertices: TopoRef[];
  };
}

// ============================================================================
// Part Studio
// ============================================================================

export interface PartStudio {
  id: PartStudioId;
  name: string;

  /** Sketch planes (includes datum planes) */
  planes: Map<SketchPlaneId, SketchPlane>;

  /** All sketches */
  sketches: Map<SketchId, Sketch>;

  /** Operation graph */
  opGraph: Map<OpId, OpNode>;

  /** Topologically sorted operation order */
  opOrder: OpId[];

  // === Runtime state (populated after rebuild) ===

  /** Results of each operation */
  results?: Map<OpId, OpResult>;

  /** Any errors during rebuild */
  rebuildErrors?: Map<OpId, string>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new empty part studio.
 */
export function createPartStudio(name: string): PartStudio {
  return {
    id: newId("PartStudio"),
    name,
    planes: getDatumPlanes(),
    sketches: new Map(),
    opGraph: new Map(),
    opOrder: [],
  };
}

/**
 * Create a deep copy of a part studio (without runtime state).
 */
export function clonePartStudio(studio: PartStudio): PartStudio {
  return {
    ...studio,
    id: newId("PartStudio"),
    planes: new Map(studio.planes),
    sketches: new Map(
      Array.from(studio.sketches.entries()).map(([id, sketch]) => [
        id,
        {
          ...sketch,
          primitives: new Map(sketch.primitives),
          constraints: new Map(sketch.constraints),
        },
      ])
    ),
    opGraph: new Map(
      Array.from(studio.opGraph.entries()).map(([id, node]) => [
        id,
        { ...node, deps: [...node.deps] },
      ])
    ),
    opOrder: [...studio.opOrder],
    results: undefined,
    rebuildErrors: undefined,
  };
}

// ============================================================================
// Accessors
// ============================================================================

/**
 * Get an operation by ID.
 */
export function getOp(studio: PartStudio, opId: OpId): Op | undefined {
  return studio.opGraph.get(opId)?.op;
}

/**
 * Get all operations in evaluation order.
 */
export function getOpsInOrder(studio: PartStudio): Op[] {
  return studio.opOrder
    .map((id) => studio.opGraph.get(id)?.op)
    .filter((op): op is Op => op !== undefined);
}

/**
 * Get the result of an operation.
 */
export function getOpResult(studio: PartStudio, opId: OpId): OpResult | undefined {
  return studio.results?.get(opId);
}

/**
 * Get all meshes for rendering.
 */
export function getAllMeshes(studio: PartStudio): Array<{ opId: OpId; mesh: Mesh }> {
  if (!studio.results) return [];

  const meshes: Array<{ opId: OpId; mesh: Mesh }> = [];
  for (const [opId, result] of studio.results) {
    if (result.mesh) {
      meshes.push({ opId, mesh: result.mesh });
    }
  }
  return meshes;
}

/**
 * Check if the studio has any rebuild errors.
 */
export function hasRebuildErrors(studio: PartStudio): boolean {
  return (studio.rebuildErrors?.size ?? 0) > 0;
}

/**
 * Get the final shape handle (last operation's result).
 */
export function getFinalShape(studio: PartStudio): number | undefined {
  if (!studio.results || studio.opOrder.length === 0) return undefined;

  // Find the last non-sketch operation with a result
  for (let i = studio.opOrder.length - 1; i >= 0; i--) {
    const opId = studio.opOrder[i];
    const node = studio.opGraph.get(opId);
    if (node?.op.type !== "sketch") {
      const result = studio.results.get(opId);
      if (result) return result.shapeHandle;
    }
  }

  return undefined;
}
