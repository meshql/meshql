import { ParseError } from "../errors/index.js";
import {
  FILTER_OPS,
  isFilterOp,
  type Filter,
  type ListOptions,
  type OrderBy,
} from "../planner/list-options.js";
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

/**
 * Parse a MeshQL query encoded as JSON field selection.
 *
 * The wire format is a single-root selection map:
 *
 * ```json
 * { "user": { "id": true, "name": true, "tokens": { "accessToken": true } } }
 * ```
 *
 * Keys starting with `$` are reserved for MeshQL metadata. Currently only
 * `$list` is supported; unknown `$`-prefixed keys throw a `ParseError` so
 * typos aren't silently ignored.
 */
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

  const obj = parsed as Record<string, unknown>;
  const entityEntries: [string, unknown][] = [];
  let listRaw: unknown;

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("$")) {
      if (key === "$list") {
        listRaw = value;
        continue;
      }
      throw new ParseError(
        `Unknown meta key '${key}' - only '$list' is currently supported`,
      );
    }
    entityEntries.push([key, value]);
  }

  if (entityEntries.length !== 1) {
    throw new ParseError("JSON query must have exactly one root entity");
  }

  const [rootName, rootValue] = entityEntries[0]!;
  const ast: AST = { root: jsonNodeToAst(rootName, rootValue) };

  if (listRaw !== undefined) {
    ast.list = parseListOptions(listRaw);
  }

  return ast;
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

/**
 * Parse and shape-check a `$list` payload.
 *
 * Only syntactic validation (types, shapes, known operator names) happens
 * here \u2014 field existence and range checks are the validator's job so
 * the parser stays schema-agnostic.
 */
function parseListOptions(raw: unknown): ListOptions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError("'$list' must be an object");
  }

  const obj = raw as Record<string, unknown>;
  const out: ListOptions = {};

  if ("limit" in obj) {
    const limit = obj.limit;
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
      throw new ParseError("'$list.limit' must be a positive integer");
    }
    out.limit = limit;
  }

  if ("cursor" in obj) {
    const cursor = obj.cursor;
    if (typeof cursor !== "string" || cursor.length === 0) {
      throw new ParseError("'$list.cursor' must be a non-empty string");
    }
    out.cursor = cursor;
  }

  if ("orderBy" in obj) {
    const orderBy = obj.orderBy;
    if (!Array.isArray(orderBy)) {
      throw new ParseError("'$list.orderBy' must be an array");
    }
    out.orderBy = orderBy.map(parseOrderBy);
  }

  if ("filter" in obj) {
    const filter = obj.filter;
    if (!Array.isArray(filter)) {
      throw new ParseError("'$list.filter' must be an array");
    }
    out.filter = filter.map(parseFilter);
  }

  return out;
}

function parseOrderBy(entry: unknown, index: number): OrderBy {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new ParseError(`'$list.orderBy[${index}]' must be an object`);
  }
  const { field, dir } = entry as Record<string, unknown>;
  if (typeof field !== "string" || field.length === 0) {
    throw new ParseError(`'$list.orderBy[${index}].field' must be a non-empty string`);
  }
  if (dir !== "asc" && dir !== "desc") {
    throw new ParseError(`'$list.orderBy[${index}].dir' must be 'asc' or 'desc'`);
  }
  return { field, dir };
}

function parseFilter(entry: unknown, index: number): Filter {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new ParseError(`'$list.filter[${index}]' must be an object`);
  }
  const { field, op, value } = entry as Record<string, unknown>;
  if (typeof field !== "string" || field.length === 0) {
    throw new ParseError(`'$list.filter[${index}].field' must be a non-empty string`);
  }
  if (typeof op !== "string" || !isFilterOp(op)) {
    throw new ParseError(
      `'$list.filter[${index}].op' must be one of: ${FILTER_OPS.join(", ")}`,
    );
  }
  // `value` may be any JSON type \u2014 scalar for comparison ops, array for
  // in/nin, string for like/ilike. Semantic checks live in the validator/
  // resolver.
  return { field, op, value };
}

/** Parse a query in the given transport format. */
export function parseQuery(raw: string, format: "json" | "ql" = "ql"): AST {
  return format === "json" ? parseJson(raw) : parseQl(raw);
}

export type { AST, ASTNode } from "./ast.js";
export { tokenize } from "./tokenizer.js";
