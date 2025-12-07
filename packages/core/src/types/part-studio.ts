/**
 * Part Studio - contains sketches and operations that define geometry.
 *
 * This is the core file format for vibeCAD. Each .vibecad file is a single PartStudio.
 * There is no distinction between "part studio" and "assembly" - assemblies are just
 * PartStudios that use InsertPart and Mate operations.
 */

import { OpId, PartStudioId, SketchId, SketchPlaneId, PrimitiveId, newId } from "./id";
import { Vec3 } from "./math";
import { SketchPlane, getDatumPlanes, DATUM_XY } from "./plane";
import { Sketch, createSketch } from "./sketch";
import { Op, TopoRef, SketchOp, ExtrudeOp } from "./op";
import { PointPrimitive, LinePrimitive } from "./primitive";
import { dimLiteral } from "./constraint";
import { ParamEnv, createParamEnv } from "./params";

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

/** Metadata for a PartStudio file */
export interface PartStudioMeta {
  createdAt: number;
  modifiedAt: number;
  version: number;
}

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

  /** Parameters / variables for this file */
  params: ParamEnv;

  /** File metadata */
  meta: PartStudioMeta;

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
  const now = Date.now();
  return {
    id: newId("PartStudio"),
    name,
    planes: getDatumPlanes(),
    sketches: new Map(),
    opGraph: new Map(),
    opOrder: [],
    params: createParamEnv(),
    meta: {
      createdAt: now,
      modifiedAt: now,
      version: 1,
    },
  };
}

/**
 * Create a part studio with a default 10cm x 10cm x 10cm cube.
 * The cube is created from a sketch on the XY plane with a square, extruded 100mm.
 */
export function createPartStudioWithCube(name: string): PartStudio {
  const studio = createPartStudio(name);

  // Create 4 corner points for the 10cm x 10cm square (100mm x 100mm)
  const p1Id = newId("Primitive") as PrimitiveId;
  const p2Id = newId("Primitive") as PrimitiveId;
  const p3Id = newId("Primitive") as PrimitiveId;
  const p4Id = newId("Primitive") as PrimitiveId;

  const p1: PointPrimitive = { id: p1Id, type: "point", x: 0, y: 0, construction: false };
  const p2: PointPrimitive = { id: p2Id, type: "point", x: 100, y: 0, construction: false };
  const p3: PointPrimitive = { id: p3Id, type: "point", x: 100, y: 100, construction: false };
  const p4: PointPrimitive = { id: p4Id, type: "point", x: 0, y: 100, construction: false };

  // Create 4 lines connecting the points
  const l1Id = newId("Primitive") as PrimitiveId;
  const l2Id = newId("Primitive") as PrimitiveId;
  const l3Id = newId("Primitive") as PrimitiveId;
  const l4Id = newId("Primitive") as PrimitiveId;

  const l1: LinePrimitive = { id: l1Id, type: "line", start: p1Id, end: p2Id, construction: false };
  const l2: LinePrimitive = { id: l2Id, type: "line", start: p2Id, end: p3Id, construction: false };
  const l3: LinePrimitive = { id: l3Id, type: "line", start: p3Id, end: p4Id, construction: false };
  const l4: LinePrimitive = { id: l4Id, type: "line", start: p4Id, end: p1Id, construction: false };

  // Create the sketch on XY plane
  const sketch = createSketch("Sketch 1", DATUM_XY.id);
  sketch.primitives.set(p1Id, p1);
  sketch.primitives.set(p2Id, p2);
  sketch.primitives.set(p3Id, p3);
  sketch.primitives.set(p4Id, p4);
  sketch.primitives.set(l1Id, l1);
  sketch.primitives.set(l2Id, l2);
  sketch.primitives.set(l3Id, l3);
  sketch.primitives.set(l4Id, l4);

  // Set solved positions (since we don't have constraints driving them, they're already solved)
  sketch.solvedPositions = new Map([
    [p1Id, [0, 0]],
    [p2Id, [100, 0]],
    [p3Id, [100, 100]],
    [p4Id, [0, 100]],
  ]);
  sketch.solveStatus = "ok";
  sketch.dof = 0;

  studio.sketches.set(sketch.id, sketch);

  // Create sketch operation
  const sketchOpId = newId("Op") as OpId;
  const sketchOp: SketchOp = {
    id: sketchOpId,
    type: "sketch",
    name: "Sketch 1",
    suppressed: false,
    sketchId: sketch.id,
    planeRef: DATUM_XY.id,
  };

  // Create extrude operation (100mm = 10cm depth)
  const extrudeOpId = newId("Op") as OpId;
  const extrudeOp: ExtrudeOp = {
    id: extrudeOpId,
    type: "extrude",
    name: "Extrude 1",
    suppressed: false,
    profile: {
      type: "sketch",
      sketchId: sketch.id,
    },
    direction: "normal",
    depth: dimLiteral(100),
  };

  // Add operations to the graph (tree structure - extrude depends on sketch)
  studio.opGraph.set(sketchOpId, { op: sketchOp, deps: [] });
  studio.opGraph.set(extrudeOpId, { op: extrudeOp, deps: [sketchOpId] });
  studio.opOrder = [sketchOpId, extrudeOpId];

  return studio;
}

/**
 * Create a deep copy of a part studio (without runtime state).
 */
export function clonePartStudio(studio: PartStudio): PartStudio {
  const now = Date.now();
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
    params: {
      params: new Map(studio.params.params),
      errors: new Map(studio.params.errors),
    },
    meta: {
      createdAt: now,
      modifiedAt: now,
      version: 1,
    },
    results: undefined,
    rebuildErrors: undefined,
  };
}

/**
 * Update part studio metadata (modifiedAt, version).
 */
export function touchPartStudio(studio: PartStudio): PartStudio {
  return {
    ...studio,
    meta: {
      ...studio.meta,
      modifiedAt: Date.now(),
      version: studio.meta.version + 1,
    },
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
