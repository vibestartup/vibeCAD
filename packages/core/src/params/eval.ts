/**
 * Expression evaluation - evaluate parsed expressions.
 */

import { Expr } from "./parser";

// ============================================================================
// Built-in Functions
// ============================================================================

const BUILT_IN_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  // Math functions
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sqrt: Math.sqrt,
  pow: Math.pow,
  exp: Math.exp,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,

  // Trig functions
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,

  // Utility
  min: Math.min,
  max: Math.max,
  clamp: (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x)),

  // Angle conversion
  deg: (x: number) => (x * Math.PI) / 180,
  rad: (x: number) => (x * 180) / Math.PI,
};

// ============================================================================
// Built-in Constants
// ============================================================================

const BUILT_IN_CONSTANTS: Record<string, number> = {
  PI: Math.PI,
  E: Math.E,
  TAU: 2 * Math.PI,
};

// ============================================================================
// Evaluation
// ============================================================================

export interface EvalContext {
  vars: Record<string, number>;
}

/**
 * Evaluate a parsed expression.
 */
export function evalExpression(expr: Expr, ctx: EvalContext): number {
  switch (expr.type) {
    case "number":
      return expr.value;

    case "ident": {
      // Check built-in constants first
      if (expr.name in BUILT_IN_CONSTANTS) {
        return BUILT_IN_CONSTANTS[expr.name];
      }

      // Then user variables
      if (expr.name in ctx.vars) {
        return ctx.vars[expr.name];
      }

      throw new Error(`Unknown variable: ${expr.name}`);
    }

    case "unary": {
      const arg = evalExpression(expr.arg, ctx);
      return -arg;
    }

    case "binary": {
      const left = evalExpression(expr.left, ctx);
      const right = evalExpression(expr.right, ctx);

      switch (expr.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          if (right === 0) {
            throw new Error("Division by zero");
          }
          return left / right;
        case "^":
          return Math.pow(left, right);
      }
    }

    case "call": {
      const fn = BUILT_IN_FUNCTIONS[expr.fn];
      if (!fn) {
        throw new Error(`Unknown function: ${expr.fn}`);
      }

      const args = expr.args.map((arg) => evalExpression(arg, ctx));
      return fn(...args);
    }
  }
}

/**
 * Evaluate an expression string directly.
 */
export function evaluate(
  exprStr: string,
  vars: Record<string, number> = {}
): number {
  const { parseExpression } = require("./parser");
  const expr = parseExpression(exprStr);
  return evalExpression(expr, { vars });
}

/**
 * Safe evaluation that returns a result or error.
 */
export function safeEvaluate(
  exprStr: string,
  vars: Record<string, number> = {}
): { value: number; error?: undefined } | { value?: undefined; error: string } {
  try {
    const value = evaluate(exprStr, vars);
    if (!Number.isFinite(value)) {
      return { error: "Result is not a finite number" };
    }
    return { value };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
