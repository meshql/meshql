import { describe, expect, it } from "vitest";
import { PluginRunner } from "./runner.js";
import type { MeshPlugin, PluginContext } from "./types.js";
import { MeshError } from "../errors/index.js";
import { createQueryContext } from "../resolver/context.js";
import type { JoinPlan } from "../planner/join-plan.js";

function baseCtx(): PluginContext {
  return {
    queryContext: createQueryContext({ requestId: "1", method: "GET" }),
    startTime: Date.now(),
  };
}

const samplePlan: JoinPlan = {
  rootEntity: "user",
  fields: ["users.id"],
  idField: "id",
  joins: [],
  context: createQueryContext({ requestId: "1", method: "GET" }),
};

describe("PluginRunner", () => {
  it("runs onRequest plugins in registration order", async () => {
    const order: string[] = [];
    const runner = new PluginRunner();

    runner.register({
      name: "a",
      onRequest(raw) {
        order.push("a");
        return `${raw}-a`;
      },
    });
    runner.register({
      name: "b",
      onRequest(raw) {
        order.push("b");
        return `${raw}-b`;
      },
    });

    const result = await runner.runOnRequest("q", baseCtx());
    expect(order).toEqual(["a", "b"]);
    expect(result).toBe("q-a-b");
  });

  it("runs onResult and onResponse in reverse order", async () => {
    const order: string[] = [];
    const runner = new PluginRunner();
    const ctx = baseCtx();

    runner.register({
      name: "a",
      onResult(v) {
        order.push("result-a");
        return v;
      },
      onResponse(v) {
        order.push("response-a");
        return v;
      },
    });
    runner.register({
      name: "b",
      onResult(v) {
        order.push("result-b");
        return v;
      },
      onResponse(v) {
        order.push("response-b");
        return v;
      },
    });

    await runner.runOnResult("raw", ctx);
    await runner.runOnResponse("shaped", ctx);

    expect(order).toEqual(["result-b", "result-a", "response-b", "response-a"]);
  });

  it("notifies all plugins on error", async () => {
    const errors: string[] = [];
    const runner = new PluginRunner();
    const ctx = baseCtx();
    const err = new MeshError("fail", "TestError");

    runner.register({
      name: "a",
      onError: () => {
        errors.push("a");
      },
    });
    runner.register({
      name: "b",
      onError: () => {
        errors.push("b");
      },
    });

    await runner.runOnError(err, ctx);
    expect(errors).toEqual(["a", "b"]);
  });

  it("runs onPlan sequentially", async () => {
    const runner = new PluginRunner();
    runner.register({
      name: "strip",
      onPlan(plan) {
        return { ...plan, fields: plan.fields.slice(0, 1) };
      },
    });

    const result = await runner.runOnPlan(
      { ...samplePlan, fields: ["users.id", "users.name"] },
      baseCtx(),
    );

    expect(result).toEqual({ ...samplePlan, fields: ["users.id"] });
  });
});
