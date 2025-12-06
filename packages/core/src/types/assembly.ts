/**
 * Assembly - collection of part instances with constraints.
 */

import {
  AssemblyConstraintId,
  AssemblyId,
  PartId,
  PartInstanceId,
  newId,
} from "./id";
import { Mat3, Vec3, mat3 } from "./math";
import { DimValue } from "./constraint";
import { TopoRef } from "./op";

// ============================================================================
// Transform
// ============================================================================

/** 3D rigid transform (rotation + translation) */
export interface Transform {
  rotation: Mat3;
  translation: Vec3;
}

export const IDENTITY_TRANSFORM: Transform = {
  rotation: mat3.identity(),
  translation: [0, 0, 0],
};

/**
 * Compose two transforms: result = a * b
 */
export function composeTransforms(a: Transform, b: Transform): Transform {
  return {
    rotation: mat3.multiply(a.rotation, b.rotation),
    translation: vec3Add(
      mat3.transformVec3(a.rotation, b.translation),
      a.translation
    ),
  };
}

/**
 * Invert a transform.
 */
export function invertTransform(t: Transform): Transform {
  const invRot = mat3.transpose(t.rotation);
  return {
    rotation: invRot,
    translation: vec3Negate(mat3.transformVec3(invRot, t.translation)),
  };
}

/**
 * Apply transform to a point.
 */
export function transformPoint(t: Transform, p: Vec3): Vec3 {
  return vec3Add(mat3.transformVec3(t.rotation, p), t.translation);
}

// Helper functions (avoiding circular import)
function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vec3Negate(v: Vec3): Vec3 {
  return [-v[0], -v[1], -v[2]];
}

// ============================================================================
// Part Instance
// ============================================================================

/** An instance of a part in an assembly */
export interface PartInstance {
  id: PartInstanceId;
  /** Which part this is an instance of */
  partId: PartId;
  /** Transform from part space to assembly space */
  transform: Transform;
  /** If true, this instance cannot be moved by constraints */
  fixed: boolean;
  /** Display name (defaults to part name) */
  name?: string;
}

// ============================================================================
// Assembly Constraints
// ============================================================================

interface AssemblyConstraintBase {
  id: AssemblyConstraintId;
  instanceA: PartInstanceId;
  instanceB: PartInstanceId;
}

export type MateType = "coincident" | "parallel" | "perpendicular";

/** Mate two faces/edges/points */
export interface MateConstraint extends AssemblyConstraintBase {
  type: "mate";
  refA: TopoRef;
  refB: TopoRef;
  mateType: MateType;
  offset?: DimValue;
}

export type AxisType = "concentric" | "coaxial";

/** Align cylindrical features */
export interface AxisConstraint extends AssemblyConstraintBase {
  type: "axis";
  refA: TopoRef;
  refB: TopoRef;
  axisType: AxisType;
}

/** Set distance between elements */
export interface AssemblyDistanceConstraint extends AssemblyConstraintBase {
  type: "distance";
  refA: TopoRef;
  refB: TopoRef;
  distance: DimValue;
}

/** Fix angle between elements */
export interface AssemblyAngleConstraint extends AssemblyConstraintBase {
  type: "angle";
  refA: TopoRef;
  refB: TopoRef;
  angle: DimValue;
}

export type AssemblyConstraint =
  | MateConstraint
  | AxisConstraint
  | AssemblyDistanceConstraint
  | AssemblyAngleConstraint;

export type AssemblyConstraintType = AssemblyConstraint["type"];

// ============================================================================
// Assembly
// ============================================================================

export interface Assembly {
  id: AssemblyId;
  name: string;

  /** Part instances */
  instances: Map<PartInstanceId, PartInstance>;

  /** Assembly constraints */
  constraints: Map<AssemblyConstraintId, AssemblyConstraint>;

  // === Solver output ===

  /** Solved transforms (after constraint solving) */
  solvedTransforms?: Map<PartInstanceId, Transform>;

  /** Solve status */
  solveStatus?: "ok" | "under-constrained" | "over-constrained" | "error";
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new empty assembly.
 */
export function createAssembly(name: string): Assembly {
  return {
    id: newId("Assembly"),
    name,
    instances: new Map(),
    constraints: new Map(),
  };
}

/**
 * Create a part instance.
 */
export function createPartInstance(
  partId: PartId,
  transform: Transform = IDENTITY_TRANSFORM,
  fixed = false
): PartInstance {
  return {
    id: newId("PartInstance"),
    partId,
    transform,
    fixed,
  };
}

// ============================================================================
// Accessors
// ============================================================================

/**
 * Get all instances of a specific part.
 */
export function getInstancesOfPart(
  assembly: Assembly,
  partId: PartId
): PartInstance[] {
  return Array.from(assembly.instances.values()).filter(
    (inst) => inst.partId === partId
  );
}

/**
 * Get all constraints affecting an instance.
 */
export function getConstraintsForInstance(
  assembly: Assembly,
  instanceId: PartInstanceId
): AssemblyConstraint[] {
  return Array.from(assembly.constraints.values()).filter(
    (c) => c.instanceA === instanceId || c.instanceB === instanceId
  );
}

/**
 * Get the effective transform for an instance (solved or initial).
 */
export function getInstanceTransform(
  assembly: Assembly,
  instanceId: PartInstanceId
): Transform | undefined {
  // Prefer solved transform
  if (assembly.solvedTransforms?.has(instanceId)) {
    return assembly.solvedTransforms.get(instanceId);
  }

  // Fall back to initial transform
  return assembly.instances.get(instanceId)?.transform;
}
