import { describe, expect, it } from "vitest";
import { recordPlanSql } from "../trace/sql-trace.js";
import { createMesh } from "../index.js";

const schema = {
  entities: {
    user: {
      fields: ["id", "name"],
      table: "users",
    },
  },
  joins: {},
};

describe("executeDetailed + SQL trace", () => {
  it("returns meta.plan and captured SQL", async () => {
    const mesh = createMesh(schema);
    mesh.resolve("*", async (plan) => {
      recordPlanSql(plan, {
        sql: "SELECT users.id, users.name FROM users",
        params: [],
      });
      return [{ user_id: 1, user_name: "Ada" }];
    });

    const result = await mesh.executeDetailed(
      JSON.stringify({ user: { id: true, name: true } }),
      {
        format: "json",
        list: false,
        trace: { sql: true },
      },
    );

    expect(result.data).toEqual({ id: 1, name: "Ada" });
    expect(result.meta.plan.fields).toContain("users.id");
    expect(result.meta.sql?.[0]?.sql).toMatch(/SELECT/i);
  });
});
