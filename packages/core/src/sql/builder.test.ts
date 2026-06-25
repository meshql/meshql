import { describe, expect, it } from "vitest";
import { buildJoinPlan } from "../planner/join-plan.js";
import { buildSelectSql } from "./builder.js";
import { createQueryContext } from "../resolver/context.js";
import { parseQl } from "../parser/index.js";
import type { MeshSchema } from "../schema/schema.js";

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

describe("buildSelectSql", () => {
  it("builds select with quoted aliases, joins, and where clause", () => {
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

    // Aliases are double-quoted so Postgres preserves the camelCase used by
    // the shaper. `tokens.id` is auto-added by the planner so the shaper can
    // dedupe Cartesian-product rows.
    expect(sql).toBe(
      'SELECT users.id AS "user_id", users.name AS "user_name", tokens.access_token AS "tokens_accessToken", tokens.id AS "tokens_id" FROM users LEFT JOIN tokens ON tokens.user_id = users.id WHERE users.id = $1',
    );
    expect(params).toEqual(["123"]);
  });
});
