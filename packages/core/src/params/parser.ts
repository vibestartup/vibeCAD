/**
 * Expression parser - tokenize and parse mathematical expressions.
 */

// ============================================================================
// Token Types
// ============================================================================

type TokenType =
  | "number"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "comma"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// ============================================================================
// AST Types
// ============================================================================

export type Expr =
  | { type: "number"; value: number }
  | { type: "ident"; name: string }
  | { type: "binary"; op: BinaryOp; left: Expr; right: Expr }
  | { type: "unary"; op: UnaryOp; arg: Expr }
  | { type: "call"; fn: string; args: Expr[] };

export type BinaryOp = "+" | "-" | "*" | "/" | "^";
export type UnaryOp = "-" | "+";

// ============================================================================
// Tokenizer
// ============================================================================

const OPERATORS = new Set(["+", "-", "*", "/", "^"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    const char = input[pos];

    // Skip whitespace
    if (/\s/.test(char)) {
      pos++;
      continue;
    }

    // Number
    if (/\d/.test(char) || (char === "." && /\d/.test(input[pos + 1]))) {
      const start = pos;
      while (pos < input.length && /[\d.]/.test(input[pos])) {
        pos++;
      }
      // Handle scientific notation
      if (input[pos] === "e" || input[pos] === "E") {
        pos++;
        if (input[pos] === "+" || input[pos] === "-") {
          pos++;
        }
        while (pos < input.length && /\d/.test(input[pos])) {
          pos++;
        }
      }
      tokens.push({ type: "number", value: input.slice(start, pos), pos: start });
      continue;
    }

    // Identifier
    if (/[a-zA-Z_]/.test(char)) {
      const start = pos;
      while (pos < input.length && /[a-zA-Z_0-9]/.test(input[pos])) {
        pos++;
      }
      tokens.push({ type: "ident", value: input.slice(start, pos), pos: start });
      continue;
    }

    // Operators
    if (OPERATORS.has(char)) {
      tokens.push({ type: "op", value: char, pos });
      pos++;
      continue;
    }

    // Parentheses
    if (char === "(") {
      tokens.push({ type: "lparen", value: "(", pos });
      pos++;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rparen", value: ")", pos });
      pos++;
      continue;
    }

    // Comma
    if (char === ",") {
      tokens.push({ type: "comma", value: ",", pos });
      pos++;
      continue;
    }

    throw new Error(`Unexpected character '${char}' at position ${pos}`);
  }

  tokens.push({ type: "eof", value: "", pos });
  return tokens;
}

// ============================================================================
// Parser
// ============================================================================

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(`Expected ${type} but got ${token.type} at position ${token.pos}`);
    }
    return this.advance();
  }

  parse(): Expr {
    const expr = this.parseExpression();
    this.expect("eof");
    return expr;
  }

  private parseExpression(): Expr {
    return this.parseAddSub();
  }

  private parseAddSub(): Expr {
    let left = this.parseMulDiv();

    while (
      this.current().type === "op" &&
      (this.current().value === "+" || this.current().value === "-")
    ) {
      const op = this.advance().value as BinaryOp;
      const right = this.parseMulDiv();
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parseMulDiv(): Expr {
    let left = this.parsePower();

    while (
      this.current().type === "op" &&
      (this.current().value === "*" || this.current().value === "/")
    ) {
      const op = this.advance().value as BinaryOp;
      const right = this.parsePower();
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parsePower(): Expr {
    let left = this.parseUnary();

    if (this.current().type === "op" && this.current().value === "^") {
      const op = this.advance().value as BinaryOp;
      const right = this.parsePower(); // Right associative
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parseUnary(): Expr {
    if (
      this.current().type === "op" &&
      (this.current().value === "-" || this.current().value === "+")
    ) {
      const op = this.advance().value as UnaryOp;
      const arg = this.parseUnary();
      if (op === "+") return arg; // +x is just x
      return { type: "unary", op: "-", arg };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.current();

    // Number literal
    if (token.type === "number") {
      this.advance();
      return { type: "number", value: parseFloat(token.value) };
    }

    // Identifier or function call
    if (token.type === "ident") {
      this.advance();
      const name = token.value;

      // Check for function call
      if (this.current().type === "lparen") {
        this.advance(); // consume (
        const args: Expr[] = [];

        if (this.current().type !== "rparen") {
          args.push(this.parseExpression());
          while (this.current().type === "comma") {
            this.advance(); // consume ,
            args.push(this.parseExpression());
          }
        }

        this.expect("rparen");
        return { type: "call", fn: name, args };
      }

      return { type: "ident", name };
    }

    // Parenthesized expression
    if (token.type === "lparen") {
      this.advance();
      const expr = this.parseExpression();
      this.expect("rparen");
      return expr;
    }

    throw new Error(`Unexpected token ${token.type} at position ${token.pos}`);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse an expression string into an AST.
 */
export function parseExpression(input: string): Expr {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Check if a string is a valid expression.
 */
export function isValidExpression(input: string): boolean {
  try {
    parseExpression(input);
    return true;
  } catch {
    return false;
  }
}
