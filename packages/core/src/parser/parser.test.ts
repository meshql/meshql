import { describe, expect, it } from "vitest";
import { parseQl, parseQuery, tokenize } from "./index.js";
import { parseJsonQuery } from "../query/index.js";

describe("tokenizer", () => {
  it("tokenizes ql syntax", () => {
    expect(tokenize("{ user { id name } }")).toEqual([
      { type: "LBRACE", value: "{" },
      { type: "IDENT", value: "user" },
      { type: "LBRACE", value: "{" },
      { type: "IDENT", value: "id" },
      { type: "IDENT", value: "name" },
      { type: "RBRACE", value: "}" },
      { type: "RBRACE", value: "}" },
      { type: "EOF", value: "" },
    ]);
  });
});

describe("parseQl", () => {
  it("builds nested AST", () => {
    const ast = parseQl("{ user { id name tokens { accessToken } } }");
    expect(ast.root).toEqual({
      name: "user",
      fields: ["id", "name"],
      refs: [
        {
          name: "tokens",
          fields: ["accessToken"],
          refs: [],
        },
      ],
    });
  });

  it("rejects queries that do not start with '{'", () => {
    expect(() => parseQl("user { id }")).toThrow("Query must start with '{'");
  });

  it("rejects missing '{' after entity name", () => {
    expect(() => parseQl("{ user id }")).toThrow("Expected '{' after entity 'user'");
  });

  it("rejects unclosed braces", () => {
    expect(() => parseQl("{ user { id ")).toThrow("Expected '}' closing entity 'user'");
  });

  it("rejects an empty root selection", () => {
    expect(() => parseQl("{ }")).toThrow("Expected root entity name");
  });
});

describe("parseJsonQuery — JSON selection", () => {
  it("builds a nested selection from an implicit select map", () => {
    const doc = parseJsonQuery(
      JSON.stringify({
        user: {
          id: true,
          name: true,
          tokens: { accessToken: true },
        },
      }),
    );

    expect(doc.root.name).toBe("user");
    expect(doc.root.select).toEqual({
      id: true,
      name: true,
      tokens: { name: "tokens", select: { accessToken: true } },
    });
  });

  it("accepts an explicit $select map", () => {
    const doc = parseJsonQuery(
      JSON.stringify({ user: { $select: { id: true, name: true } } }),
    );
    expect(doc.root.select).toEqual({ id: true, name: true });
  });

  it("parses control keys alongside a selection", () => {
    const doc = parseJsonQuery(
      JSON.stringify({
        user: {
          id: true,
          $where: { field: "role", op: "in", value: ["admin", "owner"] },
          $orderBy: [{ field: "createdAt", direction: "desc" }],
          $page: { first: 20 },
        },
      }),
    );

    expect(doc.root.where).toEqual({ field: "role", op: "in", value: ["admin", "owner"] });
    expect(doc.root.orderBy).toEqual([{ field: "createdAt", direction: "desc" }]);
    expect(doc.root.page).toEqual({ first: 20 });
  });

  it("rejects unknown $-prefixed control keys", () => {
    const raw = JSON.stringify({ user: { id: true, $filters: {} } });
    expect(() => parseJsonQuery(raw)).toThrow("Unknown control '$filters' on 'user'");
  });

  it("rejects a payload with zero root entities", () => {
    expect(() => parseJsonQuery(JSON.stringify({ $page: { first: 10 } }))).toThrow(
      "Query must have exactly one root entity",
    );
  });

  it("rejects a payload with two root entities", () => {
    const raw = JSON.stringify({ user: { id: true }, post: { id: true } });
    expect(() => parseJsonQuery(raw)).toThrow("Query must have exactly one root entity");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseJsonQuery("{not json}")).toThrow("Invalid JSON query");
  });

  it("rejects non-object roots", () => {
    expect(() => parseJsonQuery(JSON.stringify([]))).toThrow("Query must be a JSON object");
  });

  it("rejects null entity selections", () => {
    expect(() => parseJsonQuery(JSON.stringify({ user: null }))).toThrow(
      "Entity 'user' must be an object",
    );
  });

  it("rejects empty selections", () => {
    expect(() => parseJsonQuery(JSON.stringify({ user: {} }))).toThrow(
      "Entity 'user' must select at least one field",
    );
  });

  it("rejects invalid scalar selections", () => {
    expect(() => parseJsonQuery(JSON.stringify({ user: { id: false } }))).toThrow(
      "Invalid selection for 'user.id'",
    );
  });
});

describe("parseQuery", () => {
  it("parses the QL brace grammar", () => {
    const ast = parseQuery("{ user { id } }");
    expect(ast.root.name).toBe("user");
  });
});
