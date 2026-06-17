import { describe, expect, it } from "vitest";
import { buildJoinPlan } from "./join-plan.js";
import { parseQl } from "../parser/index.js";
import { createQueryContext } from "../resolver/context.js";
import type { MeshSchema } from "../schema/schema.js";

const schema: MeshSchema = {
  entities: {
    user: { type: {}, fields: ["id", "name"] },
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

describe("buildJoinPlan", () => {
  it("includes only requested joins", () => {
    const ast = parseQl("{ user { id tokens { accessToken } } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.rootEntity).toBe("user");
    expect(plan.fields).toEqual(["users.id", "tokens.accessToken"]);
    expect(plan.joins).toHaveLength(1);
    expect(plan.joins[0]?.on).toBe("tokens.user_id = users.id");
  });
});
