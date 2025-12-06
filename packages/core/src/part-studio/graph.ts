/**
 * Operation graph - dependency management and topological sorting.
 */

import { OpId, OpNode, Op, getOpDependencies } from "../types";

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build an operation node with computed dependencies.
 */
export function buildOpNode(op: Op): OpNode {
  return {
    op,
    deps: getOpDependencies(op),
  };
}

/**
 * Compute the topological order of operations.
 * Returns operation IDs in evaluation order.
 */
export function buildOpOrder(opGraph: Map<OpId, OpNode>): OpId[] {
  const visited = new Set<OpId>();
  const visiting = new Set<OpId>();
  const order: OpId[] = [];

  function visit(opId: OpId): boolean {
    if (visited.has(opId)) return true;
    if (visiting.has(opId)) return false; // Cycle

    visiting.add(opId);

    const node = opGraph.get(opId);
    if (node) {
      for (const depId of node.deps) {
        if (opGraph.has(depId) && !visit(depId)) {
          return false;
        }
      }
    }

    visiting.delete(opId);
    visited.add(opId);
    order.push(opId);
    return true;
  }

  for (const opId of opGraph.keys()) {
    if (!visit(opId)) {
      // Cycle detected - return partial order
      break;
    }
  }

  return order;
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Detect cycles in the operation graph.
 * Returns the cycle path if found, or null if no cycle exists.
 */
export function detectCycles(opGraph: Map<OpId, OpNode>): OpId[] | null {
  const visited = new Set<OpId>();
  const visiting = new Set<OpId>();
  const path: OpId[] = [];

  function findCycle(opId: OpId): OpId[] | null {
    if (visited.has(opId)) return null;
    if (visiting.has(opId)) {
      const cycleStart = path.indexOf(opId);
      return [...path.slice(cycleStart), opId];
    }

    visiting.add(opId);
    path.push(opId);

    const node = opGraph.get(opId);
    if (node) {
      for (const depId of node.deps) {
        if (opGraph.has(depId)) {
          const cycle = findCycle(depId);
          if (cycle) return cycle;
        }
      }
    }

    path.pop();
    visiting.delete(opId);
    visited.add(opId);
    return null;
  }

  for (const opId of opGraph.keys()) {
    const cycle = findCycle(opId);
    if (cycle) return cycle;
  }

  return null;
}

// ============================================================================
// Graph Operations
// ============================================================================

/**
 * Add an operation to the graph.
 */
export function addOp(
  opGraph: Map<OpId, OpNode>,
  op: Op
): Map<OpId, OpNode> {
  const newGraph = new Map(opGraph);
  newGraph.set(op.id, buildOpNode(op));
  return newGraph;
}

/**
 * Remove an operation from the graph.
 */
export function removeOp(
  opGraph: Map<OpId, OpNode>,
  opId: OpId
): Map<OpId, OpNode> {
  const newGraph = new Map(opGraph);
  newGraph.delete(opId);
  return newGraph;
}

/**
 * Update an operation in the graph.
 */
export function updateOp(
  opGraph: Map<OpId, OpNode>,
  op: Op
): Map<OpId, OpNode> {
  const newGraph = new Map(opGraph);
  newGraph.set(op.id, buildOpNode(op));
  return newGraph;
}

/**
 * Get all operations that depend on a given operation.
 */
export function getDependents(
  opGraph: Map<OpId, OpNode>,
  opId: OpId
): OpId[] {
  const dependents: OpId[] = [];

  for (const [id, node] of opGraph) {
    if (node.deps.includes(opId)) {
      dependents.push(id);
    }
  }

  return dependents;
}

/**
 * Get all operations that a given operation depends on (transitive).
 */
export function getAllDependencies(
  opGraph: Map<OpId, OpNode>,
  opId: OpId
): OpId[] {
  const deps = new Set<OpId>();
  const queue: OpId[] = [opId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = opGraph.get(current);

    if (node) {
      for (const depId of node.deps) {
        if (!deps.has(depId)) {
          deps.add(depId);
          queue.push(depId);
        }
      }
    }
  }

  return Array.from(deps);
}

/**
 * Check if an operation can be moved to a new position.
 * Returns true if moving wouldn't create a cycle.
 */
export function canMoveOp(
  opGraph: Map<OpId, OpNode>,
  opId: OpId,
  newIndex: number,
  currentOrder: OpId[]
): boolean {
  const node = opGraph.get(opId);
  if (!node) return false;

  // Check that all dependencies come before the new position
  for (const depId of node.deps) {
    const depIndex = currentOrder.indexOf(depId);
    if (depIndex >= newIndex) {
      return false; // Dependency would come after
    }
  }

  // Check that all dependents come after the new position
  const dependents = getDependents(opGraph, opId);
  for (const depId of dependents) {
    const depIndex = currentOrder.indexOf(depId);
    if (depIndex !== -1 && depIndex <= newIndex) {
      return false; // Dependent would come before
    }
  }

  return true;
}
