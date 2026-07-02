import { describe, expect, it } from "vitest";
import { parseJson, parseQl, parseQuery, tokenize } from "./index.js";

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

  it("never carries list metadata", () => {
    const ast = parseQl("{ user { id } }");
    expect(ast.list).toBeUndefined();
  });
});

describe("parseJson", () => {
  it("builds a nested AST from the selection map", () => {
    const ast = parseJson(
      JSON.stringify({
        user: {
          id: true,
          name: true,
          tokens: { accessToken: true },
        },
      }),
    );

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
    expect(ast.list).toBeUndefined();
  });

  it("parses $list metadata alongside a selection", () => {
    const ast = parseJson(
      JSON.stringify({
        user: { id: true, name: true },
        $list: {
          limit: 20,
          cursor: "abc123",
          orderBy: [
            { field: "createdAt", dir: "desc" },
            { field: "name", dir: "asc" },
          ],
          filter: [
            { field: "role", op: "in", value: ["admin", "owner"] },
            { field: "age", op: "gte", value: 18 },
          ],
        },
      }),
    );

    expect(ast.list).toEqual({
      limit: 20,
      cursor: "abc123",
      orderBy: [
        { field: "createdAt", dir: "desc" },
        { field: "name", dir: "asc" },
      ],
      filter: [
        { field: "role", op: "in", value: ["admin", "owner"] },
        { field: "age", op: "gte", value: 18 },
      ],
    });
  });

  it("rejects unknown $-prefixed keys", () => {
    const raw = JSON.stringify({ user: { id: true }, $filters: {} });
    expect(() => parseJson(raw)).toThrow(
      "Unknown meta key '$filters' - only '$list' is currently supported",
    );
  });

  it("rejects a payload with zero root entities", () => {
    expect(() => parseJson(JSON.stringify({ $list: { limit: 10 } }))).toThrow(
      "JSON query must have exactly one root entity",
    );
  });

  it("rejects a payload with two root entities", () => {
    const raw = JSON.stringify({ user: { id: true }, post: { id: true } });
    expect(() => parseJson(raw)).toThrow(
      "JSON query must have exactly one root entity",
    );
  });

  describe("$list.limit", () => {
    it("rejects a non-integer", () => {
      const raw = JSON.stringify({ user: { id: true }, $list: { limit: 3.14 } });
      expect(() => parseJson(raw)).toThrow("'$list.limit' must be a positive integer");
    });

    it("rejects zero and negatives", () => {
      const raw = JSON.stringify({ user: { id: true }, $list: { limit: 0 } });
      expect(() => parseJson(raw)).toThrow("'$list.limit' must be a positive integer");
    });

    it("rejects strings", () => {
      const raw = JSON.stringify({ user: { id: true }, $list: { limit: "20" } });
      expect(() => parseJson(raw)).toThrow("'$list.limit' must be a positive integer");
    });
  });

  describe("$list.orderBy", () => {
    it("rejects non-arrays", () => {
      const raw = JSON.stringify({
        user: { id: true },
        $list: { orderBy: { field: "id", dir: "asc" } },
      });
      expect(() => parseJson(raw)).toThrow("'$list.orderBy' must be an array");
    });

    it("rejects entries missing dir", () => {
      const raw = JSON.stringify({
        user: { id: true },
        $list: { orderBy: [{ field: "id" }] },
      });
      expect(() => parseJson(raw)).toThrow(
        "'$list.orderBy[0].dir' must be 'asc' or 'desc'",
      );
    });

    it("rejects invalid dir values", () => {
      const raw = JSON.stringify({
        user: { id: true },
        $list: { orderBy: [{ field: "id", dir: "up" }] },
      });
      expect(() => parseJson(raw)).toThrow(
        "'$list.orderBy[0].dir' must be 'asc' or 'desc'",
      );
    });
  });

  describe("$list.filter", () => {
    it("rejects unknown operators", () => {
      const raw = JSON.stringify({
        user: { id: true },
        $list: { filter: [{ field: "id", op: "regex", value: "^foo" }] },
      });
      expect(() => parseJson(raw)).toThrow("'$list.filter[0].op' must be one of");
    });

    it("rejects entries missing field", () => {
      const raw = JSON.stringify({
        user: { id: true },
        $list: { filter: [{ op: "eq", value: 1 }] },
      });
      expect(() => parseJson(raw)).toThrow(
        "'$list.filter[0].field' must be a non-empty string",
      );
    });

    it("accepts every supported operator", () => {
      const ops = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "like", "ilike"];
      for (const op of ops) {
        const raw = JSON.stringify({
          user: { id: true },
          $list: { filter: [{ field: "id", op, value: "x" }] },
        });
        expect(() => parseJson(raw)).not.toThrow();
      }
    });
  });

  describe("$list.cursor", () => {
    it("rejects non-strings", () => {
      const raw = JSON.stringify({
        user: { id: true },
        $list: { cursor: 42 },
      });
      expect(() => parseJson(raw)).toThrow("'$list.cursor' must be a non-empty string");
    });

    it("rejects empty strings", () => {
      const raw = JSON.stringify({
        user: { id: true },
        $list: { cursor: "" },
      });
      expect(() => parseJson(raw)).toThrow("'$list.cursor' must be a non-empty string");
    });
  });
});

describe("parseQuery", () => {
  it("routes to parseQl by default", () => {
    const ast = parseQuery("{ user { id } }");
    expect(ast.root.name).toBe("user");
  });

  it("routes to parseJson for format 'json'", () => {
    const ast = parseQuery(JSON.stringify({ user: { id: true } }), "json");
    expect(ast.root.name).toBe("user");
  });
});
