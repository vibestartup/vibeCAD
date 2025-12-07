/**
 * Operations - transformations that create or modify geometry.
 */

import { OpId, SketchId, SketchPlaneId, PrimitiveId } from "./id";
import { Vec3 } from "./math";
import { DimValue } from "./constraint";

// ============================================================================
// Topological Reference
// ============================================================================

/**
 * Reference to a topological element (face, edge, vertex) in a shape.
 * Used to reference geometry for downstream operations.
 */
export interface TopoRef {
  /** Which operation produced this geometry */
  opId: OpId;
  /** Type of topological element */
  subType: "face" | "edge" | "vertex";
  /** Index within that operation's output */
  index: number;
  /**
   * Geometric signature for re-matching after rebuild.
   * When geometry changes, we use these values to find the "same" element.
   */
  signature?: {
    center?: Vec3;
    normal?: Vec3;
    area?: number;
    length?: number;
  };
}

// ============================================================================
// Operation Base
// ============================================================================

interface OpBase {
  id: OpId;
  name: string;
  /** If true, this operation is skipped during rebuild */
  suppressed: boolean;
}

// ============================================================================
// Sketch Operation
// ============================================================================

/** Creates a sketch on a plane or face */
export interface SketchOp extends OpBase {
  type: "sketch";
  sketchId: SketchId;
  /** Reference to datum plane or a face from another operation */
  planeRef: SketchPlaneId | TopoRef;
}

// ============================================================================
// Primary Operations (Sketch -> Solid)
// ============================================================================

export type ExtrudeDirection = "normal" | "reverse" | "symmetric";

/**
 * Profile source for extrusion - can be from a sketch or an existing face.
 * This unified abstraction allows the same extrude operation to work with:
 * - Closed loops from sketches
 * - Faces from existing bodies
 */
export type ExtrudeProfile =
  | {
      type: "sketch";
      sketchId: SketchId;
      /** Specific profile indices to extrude (empty = all closed loops) */
      profileIndices?: number[];
    }
  | {
      type: "face";
      /** Reference to an existing face on a body */
      faceRef: TopoRef;
    };

export interface ExtrudeOp extends OpBase {
  type: "extrude";
  /** The profile(s) to extrude - from sketch or existing face */
  profile: ExtrudeProfile;
  direction: ExtrudeDirection;
  depth: DimValue;
  /** Optional draft angle */
  draft?: {
    angle: DimValue;
    inward: boolean;
  };
}

/**
 * Profile source for revolve - similar to extrude.
 */
export type RevolveProfile =
  | {
      type: "sketch";
      sketchId: SketchId;
      profileIndices?: number[];
    }
  | {
      type: "face";
      faceRef: TopoRef;
    };

export interface RevolveOp extends OpBase {
  type: "revolve";
  profile: RevolveProfile;
  /** Axis of revolution - either a topo ref or explicit axis */
  axis: TopoRef | { origin: Vec3; direction: Vec3 };
  /** Angle in radians (2*PI for full revolution) */
  angle: DimValue;
}

export interface SweepOp extends OpBase {
  type: "sweep";
  profileSketchId: SketchId;
  pathSketchId: SketchId;
}

export interface LoftOp extends OpBase {
  type: "loft";
  profileSketchIds: SketchId[];
  guideSketchIds?: SketchId[];
}

export type PrimaryOp = ExtrudeOp | RevolveOp | SweepOp | LoftOp;

// ============================================================================
// Secondary Operations (Solid -> Solid)
// ============================================================================

export type BooleanOperation = "union" | "subtract" | "intersect";

export interface BooleanOp extends OpBase {
  type: "boolean";
  operation: BooleanOperation;
  targetOp: OpId;
  toolOp: OpId;
}

export interface FilletOp extends OpBase {
  type: "fillet";
  targetOp: OpId;
  edges: TopoRef[];
  radius: DimValue;
}

export interface ChamferOp extends OpBase {
  type: "chamfer";
  targetOp: OpId;
  edges: TopoRef[];
  distance: DimValue;
  /** If provided, creates asymmetric chamfer */
  angle?: DimValue;
}

export interface ShellOp extends OpBase {
  type: "shell";
  targetOp: OpId;
  facesToRemove: TopoRef[];
  thickness: DimValue;
}

export type PatternType = "linear" | "circular";

export interface PatternOp extends OpBase {
  type: "pattern";
  targetOp: OpId;
  patternType: PatternType;
  /** For linear pattern */
  direction?: Vec3;
  /** For circular pattern */
  axis?: { origin: Vec3; direction: Vec3 };
  count: number;
  spacing: DimValue;
}

export interface MirrorOp extends OpBase {
  type: "mirror";
  targetOp: OpId;
  plane: SketchPlaneId | TopoRef;
}

export type SecondaryOp =
  | BooleanOp
  | FilletOp
  | ChamferOp
  | ShellOp
  | PatternOp
  | MirrorOp;

// ============================================================================
// Primitive Solid Operations (Direct solid creation without sketch)
// ============================================================================

export interface BoxOp extends OpBase {
  type: "box";
  /** Center position of the box */
  center: Vec3;
  /** Dimensions [width, depth, height] */
  dimensions: Vec3;
}

export interface CylinderOp extends OpBase {
  type: "cylinder";
  /** Center position of the cylinder base */
  center: Vec3;
  /** Axis direction (default: [0, 0, 1] for Z-up) */
  axis: Vec3;
  /** Cylinder radius */
  radius: DimValue;
  /** Cylinder height */
  height: DimValue;
}

export interface SphereOp extends OpBase {
  type: "sphere";
  /** Center position of the sphere */
  center: Vec3;
  /** Sphere radius */
  radius: DimValue;
}

export interface ConeOp extends OpBase {
  type: "cone";
  /** Center position of the cone base */
  center: Vec3;
  /** Axis direction (default: [0, 0, 1] for Z-up) */
  axis: Vec3;
  /** Base radius */
  radius1: DimValue;
  /** Top radius (0 for a point) */
  radius2: DimValue;
  /** Cone height */
  height: DimValue;
}

export type PrimitiveOp = BoxOp | CylinderOp | SphereOp | ConeOp;

// ============================================================================
// Transform Operation (Solid -> Solid)
// ============================================================================

export type TransformType = "translate" | "rotate" | "scale";

export interface TransformOp extends OpBase {
  type: "transform";
  /** The operation to transform */
  targetOp: OpId;
  /** Transform type */
  transformType: TransformType;
  /** Translation vector (for translate) */
  translation?: Vec3;
  /** Rotation axis origin (for rotate) */
  rotationOrigin?: Vec3;
  /** Rotation axis direction (for rotate) */
  rotationAxis?: Vec3;
  /** Rotation angle in radians (for rotate) */
  rotationAngle?: DimValue;
  /** Scale factor (for uniform scale) */
  scaleFactor?: DimValue;
  /** Scale center (for scale) */
  scaleCenter?: Vec3;
}

// ============================================================================
// Union Type
// ============================================================================

export type Op = SketchOp | PrimaryOp | SecondaryOp | PrimitiveOp | TransformOp;

export type OpType = Op["type"];

// ============================================================================
// Type Guards
// ============================================================================

export function isSketchOp(op: Op): op is SketchOp {
  return op.type === "sketch";
}

export function isPrimaryOp(op: Op): op is PrimaryOp {
  return ["extrude", "revolve", "sweep", "loft"].includes(op.type);
}

export function isSecondaryOp(op: Op): op is SecondaryOp {
  return ["boolean", "fillet", "chamfer", "shell", "pattern", "mirror"].includes(op.type);
}

export function isExtrudeOp(op: Op): op is ExtrudeOp {
  return op.type === "extrude";
}

export function isRevolveOp(op: Op): op is RevolveOp {
  return op.type === "revolve";
}

export function isBooleanOp(op: Op): op is BooleanOp {
  return op.type === "boolean";
}

export function isFilletOp(op: Op): op is FilletOp {
  return op.type === "fillet";
}

export function isPrimitiveOp(op: Op): op is PrimitiveOp {
  return ["box", "cylinder", "sphere", "cone"].includes(op.type);
}

export function isBoxOp(op: Op): op is BoxOp {
  return op.type === "box";
}

export function isCylinderOp(op: Op): op is CylinderOp {
  return op.type === "cylinder";
}

export function isSphereOp(op: Op): op is SphereOp {
  return op.type === "sphere";
}

export function isConeOp(op: Op): op is ConeOp {
  return op.type === "cone";
}

export function isTransformOp(op: Op): op is TransformOp {
  return op.type === "transform";
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get all operation IDs that this operation depends on.
 */
export function getOpDependencies(op: Op): OpId[] {
  const deps: OpId[] = [];

  switch (op.type) {
    case "sketch":
      if (typeof op.planeRef === "object" && "opId" in op.planeRef) {
        deps.push(op.planeRef.opId);
      }
      break;

    case "boolean":
      deps.push(op.targetOp, op.toolOp);
      break;

    case "fillet":
    case "chamfer":
    case "shell":
    case "pattern":
    case "mirror":
      deps.push(op.targetOp);
      if (op.type === "fillet" || op.type === "chamfer") {
        for (const edge of op.edges) {
          if (!deps.includes(edge.opId)) {
            deps.push(edge.opId);
          }
        }
      }
      if (op.type === "shell") {
        for (const face of op.facesToRemove) {
          if (!deps.includes(face.opId)) {
            deps.push(face.opId);
          }
        }
      }
      if (op.type === "mirror" && typeof op.plane === "object" && "opId" in op.plane) {
        deps.push(op.plane.opId);
      }
      break;

    case "extrude":
      // If profile is from a face, add dependency on source operation
      if (op.profile.type === "face") {
        deps.push(op.profile.faceRef.opId);
      }
      break;

    case "revolve":
      // If profile is from a face, add dependency on source operation
      if (op.profile.type === "face") {
        deps.push(op.profile.faceRef.opId);
      }
      if (typeof op.axis === "object" && "opId" in op.axis) {
        deps.push(op.axis.opId);
      }
      break;

    case "transform":
      deps.push(op.targetOp);
      break;

    // Primitive operations have no dependencies (they create geometry directly)
    case "box":
    case "cylinder":
    case "sphere":
    case "cone":
      // No dependencies
      break;
  }

  return deps;
}
