import { describe, expect, it } from "vitest";
import { parseJson, parseQl } from "../parser/index.js";
import { validateAst } from "./validator.js";
import type { MeshSchema } from "../schema/schema.js";

const schema: MeshSchema = {
  entities: {
    user: { type: {}, fields: ["id", "name"] },
    token: { type: {}, fields: ["accessToken", "expiresAt"] },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
    },
  },
};

describe("validateAst", () => {
  it("rejects unknown fields", () => {
    const ast = parseQl("{ user { id secret } }");
    expect(() => validateAst(ast, schema)).toThrow(
      "Field 'secret' not found on entity 'user'",
    );
  });

  it("rejects unknown join fields", () => {
    const ast = parseQl("{ user { id tokens { accessToken secret } } }");
    expect(() => validateAst(ast, schema)).toThrow(
      "Field 'secret' not found on entity 'tokens'",
    );
  });

  it("rejects unknown root entity", () => {
    const ast = parseQl("{ ghost { id } }");
    expect(() => validateAst(ast, schema)).toThrow("Unknown entity 'ghost'");
  });

  it("accepts a plural root name that maps to a declared entity's table", () => {
    const pluralSchema: MeshSchema = {
      entities: {
        user: { type: {}, fields: ["id", "name"] },
      },
      joins: {},
    };
    const ast = parseQl("{ users { id name } }");
    expect(() => validateAst(ast, pluralSchema)).not.toThrow();
  });

  it("validates refs with irregular plurals via the join's entity key", () => {
    const irregularSchema: MeshSchema = {
      entities: {
        user: { type: {}, fields: ["id", "name"] },
        address: {
          type: {},
          fields: ["id", "street", "city"],
          table: "addresses",
        },
      },
      joins: {
        "user.addresses": {
          entity: "address",
          on: "addresses.user_id = users.id",
          type: "many",
        },
      },
    };

    const ast = parseQl("{ user { id addresses { street city } } }");
    expect(() => validateAst(ast, irregularSchema)).not.toThrow();
  });

  it("reports the field error against the AST ref name, not the entity key", () => {
    const irregularSchema: MeshSchema = {
      entities: {
        user: { type: {}, fields: ["id"] },
        address: {
          type: {},
          fields: ["id", "street"],
          table: "addresses",
        },
      },
      joins: {
        "user.addresses": {
          entity: "address",
          on: "addresses.user_id = users.id",
          type: "many",
        },
      },
    };

    const ast = parseQl("{ user { id addresses { street zipcode } } }");
    expect(() => validateAst(ast, irregularSchema)).toThrow(
      "Field 'zipcode' not found on entity 'addresses'",
    );
  });
});

describe("validateAst — list options", () => {
  function withList(list: Record<string, unknown>): string {
    return JSON.stringify({
      user: { id: true, name: true },
      $list: list,
    });
  }

  it("accepts a valid list payload", () => {
    const ast = parseJson(
      withList({
        limit: 20,
        orderBy: [{ field: "name", dir: "asc" }],
        filter: [{ field: "id", op: "gt", value: 100 }],
      }),
    );
    expect(() => validateAst(ast, schema)).not.toThrow();
  });

  it("rejects a limit above the hard cap", () => {
    const ast = parseJson(withList({ limit: 500 }));
    expect(() => validateAst(ast, schema)).toThrow(
      "'list.limit' (500) exceeds maximum of 200",
    );
  });

  it("rejects orderBy pointing at an unknown field", () => {
    const ast = parseJson(withList({ orderBy: [{ field: "unknown", dir: "asc" }] }));
    expect(() => validateAst(ast, schema)).toThrow(
      "'list.orderBy[0].field' - unknown field 'unknown' on entity 'user'",
    );
  });

  it("rejects filter pointing at an unknown field", () => {
    const ast = parseJson(
      withList({ filter: [{ field: "nope", op: "eq", value: 1 }] }),
    );
    expect(() => validateAst(ast, schema)).toThrow(
      "'list.filter[0].field' - unknown field 'nope' on entity 'user'",
    );
  });

  it("rejects orderBy with a cross-entity dotted path", () => {
    // MeshQL intentionally does not resolve dotted paths in filter/orderBy.
    // Cross-entity ordering and filtering must be handled by a resolver.
    const ast = parseJson(
      withList({ orderBy: [{ field: "author.name", dir: "asc" }] }),
    );
    expect(() => validateAst(ast, schema)).toThrow(
      "'list.orderBy[0].field' - 'author.name' is a cross-entity path",
    );
  });

  it("rejects filter with a cross-entity dotted path", () => {
    const ast = parseJson(
      withList({
        filter: [{ field: "comments.body", op: "like", value: "%hello%" }],
      }),
    );
    expect(() => validateAst(ast, schema)).toThrow(
      "'list.filter[0].field' - 'comments.body' is a cross-entity path",
    );
  });

  it("rejects an empty orderBy array", () => {
    const ast = parseJson(withList({ orderBy: [] }));
    expect(() => validateAst(ast, schema)).toThrow(
      "'list.orderBy' must not be empty when present",
    );
  });

  it("rejects an empty filter array", () => {
    const ast = parseJson(withList({ filter: [] }));
    expect(() => validateAst(ast, schema)).toThrow(
      "'list.filter' must not be empty when present",
    );
  });
});
