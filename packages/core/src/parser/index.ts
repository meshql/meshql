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

    if (node.fields.length === 0 && node.refs.length === 0) {
      throw new ParseError(`Entity '${name}' must select at least one field`);
    }

    return node;
  }

  if (peek().type !== "LBRACE") {
    throw new ParseError("Query must start with '{'");
  }

  consume();
  const rootName = expect("IDENT", "Expected root entity name").value;
  const root = parseNode(rootName);
  expect("RBRACE", "Expected '}' closing query");

  if (peek().type !== "EOF") {
    throw new ParseError("Unexpected trailing content in QL query");
  }

  return { root };
}

/** Parse a MeshQL query in the QL brace grammar. */
export function parseQuery(raw: string): AST {
  return parseQl(raw);
}

export type { AST, ASTNode } from "./ast.js";
export { tokenize } from "./tokenizer.js";
