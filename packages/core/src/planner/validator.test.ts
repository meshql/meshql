import { describe, expect, it } from "vitest";
import { parseJson, parseQl } from "../parser/index.js";
import { validateAst } from "./validator.js";
import type { MeshSchema } from "../schema/schema.js";

const schema: MeshSchema = {
  entities: {
    user: { fields: ["id", "name"] },
    token: { fields: ["accessToken", "expiresAt"] },
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
        user: { fields: ["id", "name"] },
      },
      joins: {},
    };
    const ast = parseQl("{ users { id name } }");
    expect(() => validateAst(ast, pluralSchema)).not.toThrow();
  });

  it("validates refs with irregular plurals via the join's entity key", () => {
    const irregularSchema: MeshSchema = {
      entities: {
        user: { fields: ["id", "name"] },
        address: {
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
        user: { fields: ["id"] },
        address: {
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

  it("rejects a join target that points at a missing entity", () => {
    const brokenSchema: MeshSchema = {
      entities: {
        user: { fields: ["id"] },
      },
      joins: {
        "user.tokens": {
          entity: "token",
          on: "tokens.user_id = users.id",
          type: "many",
        },
      },
    };
    const ast = parseQl("{ user { id tokens { accessToken } } }");
    expect(() => validateAst(ast, brokenSchema)).toThrow(
      "Unknown entity 'token' (referenced by join 'user.tokens')",
    );
  });
});
