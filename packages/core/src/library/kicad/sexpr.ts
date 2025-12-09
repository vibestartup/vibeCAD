/**
 * S-Expression Parser for KiCad Files
 *
 * KiCad uses a Lisp-like S-expression format for its library files.
 * This parser handles:
 * - .kicad_sym (symbol libraries)
 * - .kicad_mod (footprint modules)
 * - .kicad_pcb (PCB layouts - partial support)
 *
 * S-expression syntax:
 * - Atoms: strings, numbers, symbols
 * - Lists: (element element ...)
 * - Strings: "quoted" or unquoted symbols
 * - Comments: Lines starting with #
 */

// ============================================================================
// Types
// ============================================================================

/**
 * S-expression node types.
 */
export type SExpr = SExprAtom | SExprList;

export type SExprAtom = string | number;

export interface SExprList {
  /** List tag (first element, usually a keyword) */
  tag: string;
  /** Child elements */
  children: SExpr[];
  /** Original source location (for error messages) */
  line?: number;
  col?: number;
}

/**
 * Type guard for SExprList.
 */
export function isList(expr: SExpr): expr is SExprList {
  return typeof expr === "object" && expr !== null && "tag" in expr;
}

/**
 * Type guard for atoms.
 */
export function isAtom(expr: SExpr): expr is SExprAtom {
  return typeof expr === "string" || typeof expr === "number";
}

/**
 * Type guard for string atoms.
 */
export function isString(expr: SExpr): expr is string {
  return typeof expr === "string";
}

/**
 * Type guard for number atoms.
 */
export function isNumber(expr: SExpr): expr is number {
  return typeof expr === "number";
}

// ============================================================================
// Parser
// ============================================================================

interface ParserState {
  input: string;
  pos: number;
  line: number;
  col: number;
}

/**
 * Parse an S-expression string into a tree structure.
 */
export function parseSExpr(input: string): SExprList {
  const state: ParserState = {
    input,
    pos: 0,
    line: 1,
    col: 1,
  };

  skipWhitespaceAndComments(state);

  if (peek(state) !== "(") {
    throw new SExprParseError("Expected opening parenthesis", state.line, state.col);
  }

  const result = parseList(state);

  skipWhitespaceAndComments(state);

  if (state.pos < state.input.length) {
    throw new SExprParseError("Unexpected content after expression", state.line, state.col);
  }

  return result;
}

/**
 * Parse multiple top-level S-expressions (for concatenated files).
 */
export function parseSExprMultiple(input: string): SExprList[] {
  const state: ParserState = {
    input,
    pos: 0,
    line: 1,
    col: 1,
  };

  const results: SExprList[] = [];

  while (true) {
    skipWhitespaceAndComments(state);

    if (state.pos >= state.input.length) {
      break;
    }

    if (peek(state) !== "(") {
      throw new SExprParseError("Expected opening parenthesis", state.line, state.col);
    }

    results.push(parseList(state));
  }

  return results;
}

function parseList(state: ParserState): SExprList {
  const startLine = state.line;
  const startCol = state.col;

  consume(state, "(");
  skipWhitespaceAndComments(state);

  // Read the tag (first element, must be a symbol/string)
  const tag = parseAtom(state);
  if (typeof tag !== "string") {
    throw new SExprParseError("List tag must be a symbol", state.line, state.col);
  }

  const children: SExpr[] = [];

  while (true) {
    skipWhitespaceAndComments(state);

    const char = peek(state);

    if (char === ")") {
      consume(state, ")");
      break;
    }

    if (char === "(") {
      children.push(parseList(state));
    } else if (char === undefined) {
      throw new SExprParseError("Unexpected end of input", state.line, state.col);
    } else {
      children.push(parseAtom(state));
    }
  }

  return { tag, children, line: startLine, col: startCol };
}

function parseAtom(state: ParserState): SExprAtom {
  const char = peek(state);

  if (char === '"') {
    return parseQuotedString(state);
  }

  return parseUnquotedAtom(state);
}

function parseQuotedString(state: ParserState): string {
  consume(state, '"');

  let result = "";
  let escaped = false;

  while (state.pos < state.input.length) {
    const char = state.input[state.pos];

    if (escaped) {
      switch (char) {
        case "n":
          result += "\n";
          break;
        case "r":
          result += "\r";
          break;
        case "t":
          result += "\t";
          break;
        case "\\":
          result += "\\";
          break;
        case '"':
          result += '"';
          break;
        default:
          result += char;
      }
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      advance(state);
      return result;
    } else {
      result += char;
    }

    advance(state);
  }

  throw new SExprParseError("Unterminated string", state.line, state.col);
}

function parseUnquotedAtom(state: ParserState): SExprAtom {
  const start = state.pos;

  while (state.pos < state.input.length) {
    const char = state.input[state.pos];

    if (isWhitespace(char) || char === "(" || char === ")" || char === '"') {
      break;
    }

    advance(state);
  }

  const token = state.input.slice(start, state.pos);

  if (token === "") {
    throw new SExprParseError("Expected atom", state.line, state.col);
  }

  // Try to parse as number
  const num = parseNumber(token);
  if (num !== null) {
    return num;
  }

  return token;
}

function parseNumber(token: string): number | null {
  // KiCad uses both integer and floating-point numbers
  // Also handles negative numbers

  if (/^-?\d+$/.test(token)) {
    return parseInt(token, 10);
  }

  if (/^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token)) {
    return parseFloat(token);
  }

  return null;
}

function peek(state: ParserState): string | undefined {
  return state.input[state.pos];
}

function advance(state: ParserState): void {
  if (state.input[state.pos] === "\n") {
    state.line++;
    state.col = 1;
  } else {
    state.col++;
  }
  state.pos++;
}

function consume(state: ParserState, expected: string): void {
  const actual = peek(state);
  if (actual !== expected) {
    throw new SExprParseError(
      `Expected '${expected}', got '${actual || "EOF"}'`,
      state.line,
      state.col
    );
  }
  advance(state);
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function skipWhitespaceAndComments(state: ParserState): void {
  while (state.pos < state.input.length) {
    const char = state.input[state.pos];

    if (isWhitespace(char)) {
      advance(state);
      continue;
    }

    // Skip line comments (KiCad doesn't officially use # but some tools add them)
    if (char === "#") {
      while (state.pos < state.input.length && state.input[state.pos] !== "\n") {
        advance(state);
      }
      continue;
    }

    break;
  }
}

// ============================================================================
// Error Class
// ============================================================================

export class SExprParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number
  ) {
    super(`${message} at line ${line}, col ${col}`);
    this.name = "SExprParseError";
  }
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Find a child list by tag name.
 */
export function findChild(list: SExprList, tag: string): SExprList | undefined {
  for (const child of list.children) {
    if (isList(child) && child.tag === tag) {
      return child;
    }
  }
  return undefined;
}

/**
 * Find all children with a given tag.
 */
export function findChildren(list: SExprList, tag: string): SExprList[] {
  return list.children.filter((child): child is SExprList => isList(child) && child.tag === tag);
}

/**
 * Get the first atom child (useful for simple properties).
 */
export function getAtomValue(list: SExprList): SExprAtom | undefined {
  for (const child of list.children) {
    if (isAtom(child)) {
      return child;
    }
  }
  return undefined;
}

/**
 * Get a string value from a list.
 */
export function getStringValue(list: SExprList): string | undefined {
  const value = getAtomValue(list);
  return typeof value === "string" ? value : value?.toString();
}

/**
 * Get a number value from a list.
 */
export function getNumberValue(list: SExprList): number | undefined {
  const value = getAtomValue(list);
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Get all atom values from a list.
 */
export function getAtomValues(list: SExprList): SExprAtom[] {
  return list.children.filter(isAtom);
}

/**
 * Get a property value (tag value) format.
 * e.g., (property "Reference" "R") -> "R"
 */
export function getPropertyValue(
  parent: SExprList,
  propTag: string,
  propName: string
): string | undefined {
  for (const child of findChildren(parent, propTag)) {
    const atoms = getAtomValues(child);
    if (atoms.length >= 2 && atoms[0] === propName) {
      return String(atoms[1]);
    }
  }
  return undefined;
}

/**
 * Get an XY coordinate from (xy x y) or (at x y) format.
 */
export function getXY(list: SExprList): { x: number; y: number } | undefined {
  const values = getAtomValues(list);
  if (values.length >= 2) {
    const x = typeof values[0] === "number" ? values[0] : parseFloat(String(values[0]));
    const y = typeof values[1] === "number" ? values[1] : parseFloat(String(values[1]));
    if (!isNaN(x) && !isNaN(y)) {
      return { x, y };
    }
  }
  return undefined;
}

/**
 * Get an XYZ coordinate or XY with rotation.
 */
export function getXYAngle(
  list: SExprList
): { x: number; y: number; angle?: number } | undefined {
  const values = getAtomValues(list);
  if (values.length >= 2) {
    const x = typeof values[0] === "number" ? values[0] : parseFloat(String(values[0]));
    const y = typeof values[1] === "number" ? values[1] : parseFloat(String(values[1]));
    if (isNaN(x) || isNaN(y)) {
      return undefined;
    }
    const result: { x: number; y: number; angle?: number } = { x, y };
    if (values.length >= 3) {
      const angle = typeof values[2] === "number" ? values[2] : parseFloat(String(values[2]));
      if (!isNaN(angle)) {
        result.angle = angle;
      }
    }
    return result;
  }
  return undefined;
}

/**
 * Check if a list has a specific flag (an atom child).
 */
export function hasFlag(list: SExprList, flag: string): boolean {
  return list.children.some(child => child === flag);
}

/**
 * Get the string value of a named property.
 * e.g., For (pin ... (name "VCC")), getNamedString(pin, "name") returns "VCC"
 */
export function getNamedString(list: SExprList, tag: string): string | undefined {
  const child = findChild(list, tag);
  return child ? getStringValue(child) : undefined;
}

/**
 * Get the number value of a named property.
 */
export function getNamedNumber(list: SExprList, tag: string): number | undefined {
  const child = findChild(list, tag);
  return child ? getNumberValue(child) : undefined;
}
