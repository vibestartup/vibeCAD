/**
 * Global parameters and expressions.
 */

import { ParamId, newId } from "./id";

// ============================================================================
// Parameter
// ============================================================================

export interface Parameter {
  id: ParamId;
  /** Display name (also used as variable name in expressions) */
  name: string;
  /** Expression string (e.g., "10", "Width * 0.5", "Height + 2") */
  expression: string;
  /** Evaluated numeric value */
  value: number;
  /** Display unit (e.g., "mm", "in", "deg") - for display only in v1 */
  unit?: string;
  /** Optional description */
  description?: string;
}

// ============================================================================
// Parameter Environment
// ============================================================================

export interface ParamEnv {
  /** All parameters, keyed by ID */
  params: Map<ParamId, Parameter>;
  /** Evaluation errors, keyed by parameter ID */
  errors: Map<ParamId, string>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new parameter with a literal value.
 */
export function createParam(name: string, value: number, unit?: string): Parameter {
  return {
    id: newId("Param"),
    name,
    expression: String(value),
    value,
    unit,
  };
}

/**
 * Create a new parameter with an expression.
 */
export function createParamExpr(
  name: string,
  expression: string,
  value = 0,
  unit?: string
): Parameter {
  return {
    id: newId("Param"),
    name,
    expression,
    value,
    unit,
  };
}

/**
 * Create an empty parameter environment.
 */
export function createParamEnv(): ParamEnv {
  return {
    params: new Map(),
    errors: new Map(),
  };
}

/**
 * Create a parameter environment with initial parameters.
 */
export function createParamEnvWith(params: Parameter[]): ParamEnv {
  const env = createParamEnv();
  for (const param of params) {
    env.params.set(param.id, param);
  }
  return env;
}

// ============================================================================
// Accessors
// ============================================================================

/**
 * Get a parameter by name.
 */
export function getParamByName(env: ParamEnv, name: string): Parameter | undefined {
  for (const param of env.params.values()) {
    if (param.name === name) {
      return param;
    }
  }
  return undefined;
}

/**
 * Get a parameter's value by name.
 */
export function getParamValue(env: ParamEnv, name: string): number | undefined {
  return getParamByName(env, name)?.value;
}

/**
 * Check if a parameter name is already in use.
 */
export function isParamNameTaken(env: ParamEnv, name: string, excludeId?: ParamId): boolean {
  for (const param of env.params.values()) {
    if (param.name === name && param.id !== excludeId) {
      return true;
    }
  }
  return false;
}

/**
 * Build a lookup table of parameter names to values.
 */
export function buildParamLookup(env: ParamEnv): Record<string, number> {
  const lookup: Record<string, number> = {};
  for (const param of env.params.values()) {
    lookup[param.name] = param.value;
  }
  return lookup;
}

/**
 * Check if the environment has any errors.
 */
export function hasErrors(env: ParamEnv): boolean {
  return env.errors.size > 0;
}

/**
 * Get all error messages as an array.
 */
export function getErrors(env: ParamEnv): Array<{ paramId: ParamId; message: string }> {
  return Array.from(env.errors.entries()).map(([paramId, message]) => ({
    paramId,
    message,
  }));
}
