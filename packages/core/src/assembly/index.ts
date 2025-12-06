/**
 * Assembly module - part instances and assembly constraints.
 */

import {
  Assembly,
  AssemblyConstraint,
  AssemblyConstraintId,
  PartInstance,
  PartInstanceId,
  PartId,
  Transform,
  IDENTITY_TRANSFORM,
  createPartInstance,
  newId,
} from "../types";

// ============================================================================
// Part Instance Operations
// ============================================================================

/**
 * Add a part instance to an assembly.
 */
export function addInstance(
  assembly: Assembly,
  partId: PartId,
  transform: Transform = IDENTITY_TRANSFORM,
  fixed = false
): { assembly: Assembly; instanceId: PartInstanceId } {
  const instance = createPartInstance(partId, transform, fixed);
  const newInstances = new Map(assembly.instances);
  newInstances.set(instance.id, instance);

  return {
    assembly: {
      ...assembly,
      instances: newInstances,
      solvedTransforms: undefined,
      solveStatus: undefined,
    },
    instanceId: instance.id,
  };
}

/**
 * Remove a part instance from an assembly.
 * Also removes any constraints referencing it.
 */
export function removeInstance(
  assembly: Assembly,
  instanceId: PartInstanceId
): Assembly {
  const newInstances = new Map(assembly.instances);
  newInstances.delete(instanceId);

  // Remove constraints referencing this instance
  const newConstraints = new Map(assembly.constraints);
  for (const [cid, constraint] of assembly.constraints) {
    if (
      constraint.instanceA === instanceId ||
      constraint.instanceB === instanceId
    ) {
      newConstraints.delete(cid);
    }
  }

  return {
    ...assembly,
    instances: newInstances,
    constraints: newConstraints,
    solvedTransforms: undefined,
    solveStatus: undefined,
  };
}

/**
 * Update an instance's transform.
 */
export function setInstanceTransform(
  assembly: Assembly,
  instanceId: PartInstanceId,
  transform: Transform
): Assembly {
  const instance = assembly.instances.get(instanceId);
  if (!instance) return assembly;

  const newInstances = new Map(assembly.instances);
  newInstances.set(instanceId, { ...instance, transform });

  return {
    ...assembly,
    instances: newInstances,
    solvedTransforms: undefined,
    solveStatus: undefined,
  };
}

/**
 * Toggle an instance's fixed state.
 */
export function toggleInstanceFixed(
  assembly: Assembly,
  instanceId: PartInstanceId
): Assembly {
  const instance = assembly.instances.get(instanceId);
  if (!instance) return assembly;

  const newInstances = new Map(assembly.instances);
  newInstances.set(instanceId, { ...instance, fixed: !instance.fixed });

  return {
    ...assembly,
    instances: newInstances,
    solvedTransforms: undefined,
    solveStatus: undefined,
  };
}

// ============================================================================
// Constraint Operations
// ============================================================================

/**
 * Add a constraint to an assembly.
 */
export function addAssemblyConstraint(
  assembly: Assembly,
  constraint: AssemblyConstraint
): Assembly {
  const newConstraints = new Map(assembly.constraints);
  newConstraints.set(constraint.id, constraint);

  return {
    ...assembly,
    constraints: newConstraints,
    solvedTransforms: undefined,
    solveStatus: undefined,
  };
}

/**
 * Remove a constraint from an assembly.
 */
export function removeAssemblyConstraint(
  assembly: Assembly,
  constraintId: AssemblyConstraintId
): Assembly {
  const newConstraints = new Map(assembly.constraints);
  newConstraints.delete(constraintId);

  return {
    ...assembly,
    constraints: newConstraints,
    solvedTransforms: undefined,
    solveStatus: undefined,
  };
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all instances of a specific part.
 */
export function getPartInstances(
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
export function getInstanceConstraints(
  assembly: Assembly,
  instanceId: PartInstanceId
): AssemblyConstraint[] {
  return Array.from(assembly.constraints.values()).filter(
    (c) => c.instanceA === instanceId || c.instanceB === instanceId
  );
}

/**
 * Check if an instance is fully constrained.
 */
export function isInstanceConstrained(
  assembly: Assembly,
  instanceId: PartInstanceId
): boolean {
  const instance = assembly.instances.get(instanceId);
  if (!instance) return false;
  if (instance.fixed) return true;

  // Count degrees of freedom removed by constraints
  // This is a simplified check - real implementation would use solver
  const constraints = getInstanceConstraints(assembly, instanceId);
  return constraints.length >= 1; // Very simplified
}
