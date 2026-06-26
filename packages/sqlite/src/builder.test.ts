import { describe, expect, it } from "vitest";
import {
  buildJoinPlan,
  createQueryContext,
  parseQl,
  type MeshSchema,
} from "@meshql/core";
import { buildSelectSql } from "./builder.js";

const schema: MeshSchema = {
  entities: {
    user: { type: {}, fields: ["id", "name"], table: "users" },
    token: {
      type: {},
      fields: ["accessToken", "expiresAt"],
      table: "tokens",
      columns: {
        accessToken: "access_token",
        expiresAt: "expires_at",
      },
    },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
      table: "tokens",
    },
  },
};

describe("buildSelectSql (SQLite)", () => {
  it("builds a SELECT with `?` placeholders and quoted aliases", () => {
    const ast = parseQl("{ user { id name tokens { accessToken } } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({
        requestId: "1",
        method: "GET",
        entityId: "123",
      }),
    );

    const { sql, params } = buildSelectSql(plan, schema);

    // Same select-list shape as `@meshql/postgres` (double-quoted camelCase
    // aliases, planner-injected `tokens.id` for the shaper) — the only
    // wire-format difference is the `?` placeholder in the WHERE clause.
    expect(sql).toBe(
      'SELECT users.id AS "user_id", users.name AS "user_name", tokens.access_token AS "tokens_accessToken", tokens.id AS "tokens_id" FROM users LEFT JOIN tokens ON tokens.user_id = users.id WHERE users.id = ?',
    );
    expect(params).toEqual(["123"]);
  });

  it("omits the WHERE clause and emits no params when no entity id is set", () => {
    const ast = parseQl("{ user { id name } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    const { sql, params } = buildSelectSql(plan, schema);

    expect(sql).toBe(
      'SELECT users.id AS "user_id", users.name AS "user_name" FROM users',
    );
    expect(params).toEqual([]);
  });
});
