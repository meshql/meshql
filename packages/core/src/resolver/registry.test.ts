import { describe, expect, it, vi } from "vitest";
import { CATCH_ALL, ResolverRegistry } from "./registry.js";
import type { JoinPlan } from "../planner/join-plan.js";

function fakePlan(entity: string): JoinPlan {
  return {
    rootEntity: entity,
    fields: [],
    idField: "id",
    joins: [],
    context: { requestId: "test", method: "GET" },
  };
}

describe("ResolverRegistry", () => {
  it("returns undefined when nothing is registered", () => {
    const registry = new ResolverRegistry();
    expect(registry.get("user")).toBeUndefined();
    expect(registry.has("user")).toBe(false);
    expect(registry.hasCatchAll()).toBe(false);
  });

  it("returns the specific resolver when registered", async () => {
    const registry = new ResolverRegistry();
    const handler = vi.fn(async () => ({ id: 1 }));
    registry.register("user", handler);

    const resolver = registry.get("user");
    expect(resolver).toBe(handler);
    expect(registry.has("user")).toBe(true);
  });

  it("replaces the specific resolver on re-register (no throw)", () => {
    const registry = new ResolverRegistry();
    const first = vi.fn(async () => ({ id: 1 }));
    const second = vi.fn(async () => ({ id: 2 }));

    registry.register("user", first);
    registry.register("user", second);

    expect(registry.get("user")).toBe(second);
  });
});

describe("ResolverRegistry \u2014 catch-all", () => {
  it("fires the catch-all when no specific resolver is registered", async () => {
    const registry = new ResolverRegistry();
    const catchAll = vi.fn(async (plan: JoinPlan) => ({ from: plan.rootEntity }));
    registry.register(CATCH_ALL, catchAll);

    const resolver = registry.get("user");
    expect(resolver).toBe(catchAll);

    const result = await resolver!(fakePlan("user"));
    expect(result).toEqual({ from: "user" });
  });

  it("specific resolver always wins over catch-all (registered before)", () => {
    const registry = new ResolverRegistry();
    const specific = vi.fn(async () => ({ id: 1 }));
    const catchAll = vi.fn(async () => ({ id: 999 }));

    registry.register("user", specific);
    registry.register(CATCH_ALL, catchAll);

    expect(registry.get("user")).toBe(specific);
    expect(registry.get("post")).toBe(catchAll);
  });

  it("specific resolver always wins over catch-all (registered after)", () => {
    const registry = new ResolverRegistry();
    const specific = vi.fn(async () => ({ id: 1 }));
    const catchAll = vi.fn(async () => ({ id: 999 }));

    registry.register(CATCH_ALL, catchAll);
    registry.register("user", specific);

    expect(registry.get("user")).toBe(specific);
    expect(registry.get("post")).toBe(catchAll);
  });

  it("throws when the catch-all is registered twice", () => {
    const registry = new ResolverRegistry();
    registry.register(CATCH_ALL, vi.fn(async () => ({})));
    expect(() => registry.register(CATCH_ALL, vi.fn(async () => ({})))).toThrow(
      "A catch-all resolver ('*') is already registered",
    );
  });

  it("has() returns true for any entity when catch-all is registered", () => {
    const registry = new ResolverRegistry();
    registry.register(CATCH_ALL, vi.fn(async () => ({})));

    expect(registry.has("user")).toBe(true);
    expect(registry.has("post")).toBe(true);
    expect(registry.has("anything")).toBe(true);
    expect(registry.hasCatchAll()).toBe(true);
  });

  it("hasCatchAll() is independent of specific registrations", () => {
    const registry = new ResolverRegistry();
    registry.register("user", vi.fn(async () => ({})));
    expect(registry.hasCatchAll()).toBe(false);
    expect(registry.has("user")).toBe(true);
    expect(registry.has("post")).toBe(false);
  });
});
