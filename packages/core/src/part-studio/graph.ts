/**
 * Operation tree - dependency management and topological sorting.
 *
 * Note: The op graph is actually a tree (or forest). Each operation depends only
 * on operations that were created before it. Cycles are structurally impossible
 * because you can only reference existing operations when creating a new one.
 */

import { OpId, OpNode, Op, getOpDependencies } from "../types";

// ============================================================================
// Tree Building
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
 * Compute the evaluation order of operations using depth-first traversal.
 * Since the op structure is a tree, this is a simple DFS post-order traversal.
 * Returns operation IDs in evaluation order (dependencies before dependents).
 */
export function buildOpOrder(opGraph: Map<OpId, OpNode>): OpId[] {
  const visited = new Set<OpId>();
  const order: OpId[] = [];

  function visit(opId: OpId): void {
    if (visited.has(opId)) return;
    visited.add(opId);

    const node = opGraph.get(opId);
    if (node) {
      // Visit all dependencies first
      for (const depId of node.deps) {
        if (opGraph.has(depId)) {
          visit(depId);
        }
      }
    }

    order.push(opId);
  }

  // Visit all nodes
  for (const opId of opGraph.keys()) {
    visit(opId);
  }

  return order;
}

// ============================================================================
// Tree Operations
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
 * Check if an operation can be moved to a new position in the timeline.
 * The operation must stay after all its dependencies and before all its dependents.
 */
export function canMoveOp(
  opGraph: Map<OpId, OpNode>,
  opId: OpId,
  newIndex: number,
  currentOrder: OpId[]
): boolean {
  const node = opGraph.get(opId);
  if (!node) return false;

  // Find the range where this op can be placed
  // It must be after all dependencies
  let minIndex = 0;
  for (const depId of node.deps) {
    const depIndex = currentOrder.indexOf(depId);
    if (depIndex !== -1) {
      minIndex = Math.max(minIndex, depIndex + 1);
    }
  }

  // It must be before all dependents
  let maxIndex = currentOrder.length;
  const dependents = getDependents(opGraph, opId);
  for (const depId of dependents) {
    const depIndex = currentOrder.indexOf(depId);
    if (depIndex !== -1) {
      maxIndex = Math.min(maxIndex, depIndex);
    }
  }

  return newIndex >= minIndex && newIndex < maxIndex;
}
