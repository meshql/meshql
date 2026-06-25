import { describe, expect, it } from "vitest";
import { complexityLimit } from "./complexity.js";
import { parseQl } from "../../parser/index.js";
import { createQueryContext } from "../../resolver/context.js";
import type { JoinPlan } from "../../planner/join-plan.js";
import { ValidationError } from "../../errors/index.js";

const basePlan: JoinPlan = {
  rootEntity: "user",
  fields: ["users.id", "users.name", "users.email"],
  idField: "id",
  joins: [],
  context: createQueryContext({ requestId: "1", method: "GET" }),
};

describe("complexityLimit", () => {
  it("allows queries within complexity budget", async () => {
    const plugin = complexityLimit({ max: 100, fieldCost: 1, joinCost: 10 });
    const ast = parseQl("{ user { id name } }");

    const result = await plugin.onPlan!(basePlan, {
      queryContext: createQueryContext({ requestId: "1", method: "GET" }),
      ast,
      startTime: Date.now(),
    });

    expect(result).toBe(basePlan);
  });

  it("rejects queries exceeding complexity budget", async () => {
    const plugin = complexityLimit({ max: 2, fieldCost: 1, joinCost: 10 });
    const ast = parseQl("{ user { id name email } }");

    await expect(async () => {
      await plugin.onPlan!(basePlan, {
        queryContext: createQueryContext({ requestId: "1", method: "GET" }),
        ast,
        startTime: Date.now(),
      });
    }).rejects.toThrow(ValidationError);
  });
});
