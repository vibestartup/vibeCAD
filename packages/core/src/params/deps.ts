/**
 * Parameter dependency analysis - find dependencies and detect cycles.
 */

import { ParamId, ParamEnv, Parameter } from "../types";
import { parseExpression, Expr } from "./parser";

// ============================================================================
// Dependency Extraction
// ============================================================================

/**
 * Extract all variable names referenced in an expression.
 */
export function getExpressionDeps(expression: string): string[] {
  try {
    const expr = parseExpression(expression);
    return extractIdentifiers(expr);
  } catch {
    return [];
  }
}

/**
 * Extract identifiers from a parsed expression.
 */
function extractIdentifiers(expr: Expr): string[] {
  const idents = new Set<string>();

  function walk(e: Expr): void {
    switch (e.type) {
      case "ident":
        idents.add(e.name);
        break;
      case "unary":
        walk(e.arg);
        break;
      case "binary":
        walk(e.left);
        walk(e.right);
        break;
      case "call":
        e.args.forEach(walk);
        break;
    }
  }

  walk(expr);
  return Array.from(idents);
}

// ============================================================================
// Dependency Graph
// ============================================================================

/**
 * Build a dependency graph for parameters.
 * Returns: Map<paramName, Set<dependsOnParamNames>>
 */
export function buildDependencyGraph(
  env: ParamEnv
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const paramNames = new Set<string>();

  // Collect all parameter names
  for (const param of env.params.values()) {
    paramNames.add(param.name);
  }

  // Build dependency edges
  for (const param of env.params.values()) {
    const deps = getExpressionDeps(param.expression);
    const validDeps = deps.filter((d) => paramNames.has(d));
    graph.set(param.name, new Set(validDeps));
  }

  return graph;
}

/**
 * Topologically sort parameters based on dependencies.
 * Returns parameter names in evaluation order, or null if there's a cycle.
 */
export function topologicalSort(
  graph: Map<string, Set<string>>
): string[] | null {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];

  function visit(name: string): boolean {
    if (visited.has(name)) return true;
    if (visiting.has(name)) return false; // Cycle detected

    visiting.add(name);

    const deps = graph.get(name);
    if (deps) {
      for (const dep of deps) {
        if (!visit(dep)) return false;
      }
    }

    visiting.delete(name);
    visited.add(name);
    result.push(name);
    return true;
  }

  for (const name of graph.keys()) {
    if (!visit(name)) return null;
  }

  return result;
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Detect cycles in the parameter dependency graph.
 * Returns the cycle path if found, or null if no cycle exists.
 */
export function detectCycles(env: ParamEnv): string[] | null {
  const graph = buildDependencyGraph(env);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  function findCycle(name: string): string[] | null {
    if (visited.has(name)) return null;
    if (visiting.has(name)) {
      // Found cycle - extract it from path
      const cycleStart = path.indexOf(name);
      return [...path.slice(cycleStart), name];
    }

    visiting.add(name);
    path.push(name);

    const deps = graph.get(name);
    if (deps) {
      for (const dep of deps) {
        const cycle = findCycle(dep);
        if (cycle) return cycle;
      }
    }

    path.pop();
    visiting.delete(name);
    visited.add(name);
    return null;
  }

  for (const name of graph.keys()) {
    const cycle = findCycle(name);
    if (cycle) return cycle;
  }

  return null;
}

/**
 * Get all parameters that depend on a given parameter (direct and transitive).
 */
export function getDependents(env: ParamEnv, paramName: string): string[] {
  const reverseDeps = new Map<string, Set<string>>();

  // Build reverse dependency graph
  for (const param of env.params.values()) {
    const deps = getExpressionDeps(param.expression);
    for (const dep of deps) {
      if (!reverseDeps.has(dep)) {
        reverseDeps.set(dep, new Set());
      }
      reverseDeps.get(dep)!.add(param.name);
    }
  }

  // BFS to find all dependents
  const dependents = new Set<string>();
  const queue = [paramName];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const directDeps = reverseDeps.get(current);

    if (directDeps) {
      for (const dep of directDeps) {
        if (!dependents.has(dep)) {
          dependents.add(dep);
          queue.push(dep);
        }
      }
    }
  }

  return Array.from(dependents);
}
