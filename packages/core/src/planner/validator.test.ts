import { describe, expect, it } from "vitest";
import { parseQl } from "../parser/index.js";
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
});
