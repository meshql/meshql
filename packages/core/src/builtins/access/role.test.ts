import { describe, expect, it } from "vitest";
import { roleAccessPlugin } from "./role.js";
import { createQueryContext } from "../../resolver/context.js";
import type { MeshSchema } from "../../schema/schema.js";
import type { JoinPlan } from "../../planner/join-plan.js";

const schema: MeshSchema = {
  entities: {
    user: { type: {}, fields: ["id", "email"] },
    token: { type: {}, fields: ["accessToken"] },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
    },
  },
};

describe("roleAccessPlugin", () => {
  const basePlan: JoinPlan = {
    rootEntity: "user",
    fields: ["users.id", "users.email", "tokens.accessToken"],
    idField: "id",
    joins: [
      {
        path: "tokens",
        joinKey: "user.tokens",
        entity: "token",
        on: "tokens.user_id = users.id",
        fields: ["tokens.accessToken"],
        type: "many",
        refName: "tokens",
        idField: "id",
      },
    ],
    context: createQueryContext({ requestId: "1", method: "GET" }),
  };

  it("strips fields denied by role rules", async () => {
    const plugin = roleAccessPlugin(schema, {
      rules: {
        "user.email": (ctx) => ctx.role !== "guest",
        "user.tokens.accessToken": (ctx) => ctx.role === "admin",
      },
    });

    const result = await plugin.onPlan!(basePlan, {
      queryContext: createQueryContext({
        requestId: "1",
        method: "GET",
        role: "guest",
      }),
      startTime: Date.now(),
    });

    expect("fields" in result && result.fields).toEqual(["users.id"]);
    expect("joins" in result && result.joins[0]?.fields).toEqual([]);
  });

  it("allows fields when rules pass", async () => {
    const plugin = roleAccessPlugin(schema, {
      rules: {
        "user.email": (ctx) => ctx.role !== "guest",
      },
    });

    const result = await plugin.onPlan!(basePlan, {
      queryContext: createQueryContext({
        requestId: "1",
        method: "GET",
        role: "admin",
      }),
      startTime: Date.now(),
    });

    expect("fields" in result && result.fields).toContain("users.email");
  });
});
