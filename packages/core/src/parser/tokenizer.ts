import { ParseError } from "../errors/index.js";

/** Token kinds produced by the MeshQL query lexer. */
export type TokenType = "LBRACE" | "RBRACE" | "IDENT" | "EOF";

/** A single lexer token from a MeshQL query string. */
export interface Token {
  type: TokenType;
  value: string;
}

/** Tokenize a MeshQL brace-syntax query string. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i]!;

    if (char === "{") {
      tokens.push({ type: "LBRACE", value: "{" });
      i++;
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "RBRACE", value: "}" });
      i++;
      continue;
    }
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let ident = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i]!)) {
        ident += input[i++]!;
      }
      tokens.push({ type: "IDENT", value: ident });
      continue;
    }

    throw new ParseError(
      `Unexpected character '${char}' in QL query at position ${i}`,
    );
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}
