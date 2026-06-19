import { describe, expect, it } from "vitest";
import { depthLimit } from "./depth-limit.js";
import { parseQl } from "../../parser/index.js";
import { createQueryContext } from "../../resolver/context.js";
import type { JoinPlan } from "../../planner/join-plan.js";
import { ValidationError } from "../../errors/index.js";

const basePlan: JoinPlan = {
  rootEntity: "user",
  fields: ["users.id"],
  joins: [],
  context: createQueryContext({ requestId: "1", method: "GET" }),
};

describe("depthLimit", () => {
  it("allows queries within depth limit", async () => {
    const plugin = depthLimit({ max: 3 });
    const ast = parseQl("{ user { id tokens { accessToken } } }");

    const result = await plugin.onPlan!(basePlan, {
      queryContext: createQueryContext({ requestId: "1", method: "GET" }),
      ast,
      startTime: Date.now(),
    });

    expect(result).toBe(basePlan);
  });

  it("rejects queries exceeding depth limit", async () => {
    const plugin = depthLimit({ max: 1 });
    const ast = parseQl("{ user { id tokens { accessToken } } }");

    await expect(async () => {
      await plugin.onPlan!(basePlan, {
        queryContext: createQueryContext({ requestId: "1", method: "GET" }),
        ast,
        startTime: Date.now(),
      });
    }).rejects.toThrow(ValidationError);
  });
});
