import { ParseError } from "../errors/index.js";
import type { AST, ASTNode } from "./ast.js";
import { tokenize, type Token } from "./tokenizer.js";

/** Parse a MeshQL query string in brace syntax. */
export function parseQl(query: string): AST {
  const tokens = tokenize(query.trim());
  let pos = 0;

  function peek(): Token {
    return tokens[pos] ?? { type: "EOF", value: "" };
  }

  function consume(): Token {
    const token = peek();
    pos++;
    return token;
  }

  function expect(type: Token["type"], message: string): Token {
    const token = consume();
    if (token.type !== type) {
      throw new ParseError(message);
    }
    return token;
  }

  function parseNode(name: string): ASTNode {
    const node: ASTNode = { name, fields: [], refs: [] };
    expect("LBRACE", `Expected '{' after entity '${name}'`);

    while (peek().type !== "RBRACE" && peek().type !== "EOF") {
      const ident = expect("IDENT", "Expected field or nested entity name").value;

      if (peek().type === "LBRACE") {
        node.refs.push(parseNode(ident));
      } else {
        node.fields.push(ident);
      }
    }

    expect("RBRACE", `Expected '}' closing entity '${name}'`);
    return node;
  }

  if (peek().type !== "LBRACE") {
    throw new ParseError("Query must start with '{'");
  }

  consume();
  const rootName = expect("IDENT", "Expected root entity name").value;
  const root = parseNode(rootName);

  if (peek().type === "RBRACE") {
    consume();
  }

  return { root };
}

interface JsonSelection {
  [key: string]: boolean | JsonSelection;
}

/** Parse a MeshQL query encoded as JSON field selection. */
export function parseJson(raw: string): AST {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ParseError("Invalid JSON query");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ParseError("JSON query must be an object");
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length !== 1) {
    throw new ParseError("JSON query must have exactly one root entity");
  }

  const [rootName, rootValue] = entries[0]!;
  return { root: jsonNodeToAst(rootName, rootValue) };
}

function jsonNodeToAst(name: string, value: unknown): ASTNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ParseError(`Entity '${name}' must be an object`);
  }

  const node: ASTNode = { name, fields: [], refs: [] };

  for (const [key, fieldValue] of Object.entries(value as JsonSelection)) {
    if (fieldValue === true) {
      node.fields.push(key);
    } else if (fieldValue && typeof fieldValue === "object") {
      node.refs.push(jsonNodeToAst(key, fieldValue));
    } else {
      throw new ParseError(`Invalid selection for '${name}.${key}'`);
    }
  }

  return node;
}

/** Parse a query in the given transport format. */
export function parseQuery(raw: string, format: "json" | "ql" = "ql"): AST {
  return format === "json" ? parseJson(raw) : parseQl(raw);
}

export type { AST, ASTNode } from "./ast.js";
export { tokenize } from "./tokenizer.js";
