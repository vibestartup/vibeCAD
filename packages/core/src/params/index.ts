/**
 * Parameters module - expression parsing, evaluation, and dependency management.
 */

import {
  ParamId,
  ParamEnv,
  Parameter,
  DimValue,
  buildParamLookup,
  getParamByName,
} from "../types";
import { parseExpression, isValidExpression, Expr } from "./parser";
import { evalExpression, evaluate, safeEvaluate, EvalContext } from "./eval";
import {
  getExpressionDeps,
  buildDependencyGraph,
  topologicalSort,
  detectCycles,
  getDependents,
} from "./deps";

// Re-export submodules
export { parseExpression, isValidExpression, Expr } from "./parser";
export { evalExpression, evaluate, safeEvaluate, EvalContext } from "./eval";
export {
  getExpressionDeps,
  buildDependencyGraph,
  topologicalSort,
  detectCycles,
  getDependents,
} from "./deps";

// ============================================================================
// Parameter Evaluation
// ============================================================================

/**
 * Evaluate all parameters in dependency order.
 * Returns updated environment with evaluated values and any errors.
 */
export function evaluateParams(env: ParamEnv): ParamEnv {
  const graph = buildDependencyGraph(env);
  const order = topologicalSort(graph);

  // Start with empty errors
  const newErrors = new Map<ParamId, string>();
  const newParams = new Map(env.params);

  // Check for cycles
  if (order === null) {
    const cycle = detectCycles(env);
    const cycleStr = cycle ? cycle.join(" -> ") : "unknown";

    // Mark all params in cycle as errors
    for (const param of env.params.values()) {
      if (cycle?.includes(param.name)) {
        newErrors.set(param.id, `Circular dependency: ${cycleStr}`);
      }
    }

    return { params: newParams, errors: newErrors };
  }

  // Build lookup table incrementally as we evaluate
  const lookup: Record<string, number> = {};

  // Evaluate in dependency order
  for (const name of order) {
    const param = getParamByName(env, name);
    if (!param) continue;

    const result = safeEvaluate(param.expression, lookup);

    if (result.error) {
      newErrors.set(param.id, result.error);
      lookup[name] = 0; // Use 0 as fallback for dependent params
    } else {
      lookup[name] = result.value;
      newParams.set(param.id, { ...param, value: result.value });
    }
  }

  return { params: newParams, errors: newErrors };
}

/**
 * Evaluate a single dimension value.
 */
export function evalDimValue(dim: DimValue, env: ParamEnv): number {
  // If bound to a parameter, use its value
  if (dim.paramId) {
    const param = env.params.get(dim.paramId);
    if (param) return param.value;
  }

  // If has expression, evaluate it
  if (dim.expression) {
    const lookup = buildParamLookup(env);
    const result = safeEvaluate(dim.expression, lookup);
    return result.value ?? dim.value;
  }

  // Fall back to stored value
  return dim.value;
}

/**
 * Update a dimension value with a new expression and evaluate it.
 */
export function updateDimValue(
  dim: DimValue,
  expression: string,
  env: ParamEnv
): DimValue {
  const lookup = buildParamLookup(env);
  const result = safeEvaluate(expression, lookup);

  return {
    ...dim,
    expression,
    value: result.value ?? dim.value,
  };
}

// ============================================================================
// Parameter Operations
// ============================================================================

/**
 * Add a parameter to the environment.
 */
export function addParam(env: ParamEnv, param: Parameter): ParamEnv {
  const newParams = new Map(env.params);
  newParams.set(param.id, param);
  return evaluateParams({ params: newParams, errors: new Map() });
}

/**
 * Update a parameter's expression.
 */
export function updateParamExpression(
  env: ParamEnv,
  paramId: ParamId,
  expression: string
): ParamEnv {
  const param = env.params.get(paramId);
  if (!param) return env;

  const newParams = new Map(env.params);
  newParams.set(paramId, { ...param, expression });
  return evaluateParams({ params: newParams, errors: new Map() });
}

/**
 * Update a parameter's name.
 */
export function updateParamName(
  env: ParamEnv,
  paramId: ParamId,
  name: string
): ParamEnv {
  const param = env.params.get(paramId);
  if (!param) return env;

  // Update references in other parameters' expressions
  const oldName = param.name;
  const newParams = new Map<ParamId, Parameter>();

  for (const [id, p] of env.params) {
    if (id === paramId) {
      newParams.set(id, { ...p, name });
    } else {
      // Replace references to old name with new name
      const newExpr = replaceParamReferences(p.expression, oldName, name);
      newParams.set(id, { ...p, expression: newExpr });
    }
  }

  return evaluateParams({ params: newParams, errors: new Map() });
}

/**
 * Remove a parameter from the environment.
 */
export function removeParam(env: ParamEnv, paramId: ParamId): ParamEnv {
  const newParams = new Map(env.params);
  newParams.delete(paramId);
  return evaluateParams({ params: newParams, errors: new Map() });
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Replace parameter references in an expression.
 */
function replaceParamReferences(
  expression: string,
  oldName: string,
  newName: string
): string {
  // Simple word-boundary replacement
  const regex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "g");
  return expression.replace(regex, newName);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validate a parameter name.
 */
export function isValidParamName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name);
}
