import { describe, expect, it, vi } from "vitest";
import { createMesh } from "./index.js";
import type { JoinPlan, MeshConfig, Resolver } from "./index.js";

const schema: MeshConfig = {
  entities: {
    user: { type: {}, fields: ["id", "name", "createdAt"] },
  },
  joins: {},
};

function fakeResolver(rows: Record<string, unknown>[]): Resolver {
  return vi.fn(async () => rows);
}

describe("createMesh — list options wiring", () => {
  it("passes $list from the JSON wire payload down to the resolver", async () => {
    const resolver = fakeResolver([{ user_id: 1, user_name: "Ada" }]);
    const mesh = createMesh(schema).resolve("user", resolver);

    const wire = JSON.stringify({
      user: { id: true, name: true },
      $list: {
        limit: 10,
        orderBy: [{ field: "name", dir: "asc" }],
        filter: [{ field: "id", op: "gt", value: 100 }],
      },
    });

    const result = await mesh.execute(wire, { format: "json" });

    expect(resolver).toHaveBeenCalledOnce();
    const plan = (resolver as unknown as { mock: { calls: [JoinPlan][] } }).mock
      .calls[0]![0];
    expect(plan.list).toEqual({
      limit: 10,
      orderBy: [{ field: "name", dir: "asc" }],
      filter: [{ field: "id", op: "gt", value: 100 }],
    });
    // listMode was implicitly true because $list was present.
    expect(Array.isArray(result)).toBe(true);
  });

  it("caller-supplied listOptions override wire $list", async () => {
    const resolver = fakeResolver([]);
    const mesh = createMesh(schema).resolve("user", resolver);

    const wire = JSON.stringify({
      user: { id: true },
      $list: { limit: 5 },
    });

    await mesh.execute(wire, {
      format: "json",
      listOptions: { limit: 50 },
    });

    const plan = (resolver as unknown as { mock: { calls: [JoinPlan][] } }).mock
      .calls[0]![0];
    expect(plan.list?.limit).toBe(50);
  });

  it("explicit list: false disables list-shape mode even with wire $list", async () => {
    const resolver = fakeResolver([{ user_id: 1, user_name: "Ada" }]);
    const mesh = createMesh(schema).resolve("user", resolver);

    const wire = JSON.stringify({
      user: { id: true, name: true },
      $list: { limit: 5 },
    });

    const result = await mesh.execute(wire, { format: "json", list: false });

    expect(Array.isArray(result)).toBe(false);
    // $list still attached to the plan \u2014 the resolver can honour it.
    const plan = (resolver as unknown as { mock: { calls: [JoinPlan][] } }).mock
      .calls[0]![0];
    expect(plan.list?.limit).toBe(5);
  });

  it("no wire $list, no listOptions → plan.list is undefined", async () => {
    const resolver = fakeResolver([{ user_id: 1, user_name: "Ada" }]);
    const mesh = createMesh(schema).resolve("user", resolver);

    await mesh.execute(JSON.stringify({ user: { id: true, name: true } }), {
      format: "json",
    });

    const plan = (resolver as unknown as { mock: { calls: [JoinPlan][] } }).mock
      .calls[0]![0];
    expect(plan.list).toBeUndefined();
  });

  it("propagates validator errors for invalid $list", async () => {
    const mesh = createMesh(schema).resolve("user", fakeResolver([]));

    const wire = JSON.stringify({
      user: { id: true },
      $list: { limit: 9999 },
    });

    await expect(mesh.execute(wire, { format: "json" })).rejects.toThrow(
      "'list.limit' (9999) exceeds maximum of 200",
    );
  });
});

describe("createMesh — catch-all resolver", () => {
  const multiEntitySchema: MeshConfig = {
    entities: {
      user: { type: {}, fields: ["id", "name"] },
      post: { type: {}, fields: ["id", "title"] },
    },
    joins: {},
  };

  it("routes to a catch-all when no specific resolver is registered", async () => {
    const catchAll = vi.fn(async (plan: JoinPlan) => {
      if (plan.rootEntity === "user") return { user_id: 1, user_name: "Ada" };
      if (plan.rootEntity === "post") return { post_id: 1, post_title: "Hi" };
      return {};
    });

    const mesh = createMesh(multiEntitySchema).resolve("*", catchAll);

    const user = await mesh.execute("{ user { id name } }");
    expect(user).toEqual({ id: 1, name: "Ada" });

    const post = await mesh.execute("{ post { id title } }");
    expect(post).toEqual({ id: 1, title: "Hi" });

    expect(catchAll).toHaveBeenCalledTimes(2);
  });

  it("prefers a specific resolver over the catch-all", async () => {
    const specific = vi.fn(async () => ({ user_id: 42, user_name: "Specific" }));
    const catchAll = vi.fn(async () => ({ user_id: 0, user_name: "Catch" }));

    const mesh = createMesh(multiEntitySchema)
      .resolve("user", specific)
      .resolve("*", catchAll);

    const result = await mesh.execute("{ user { id name } }");

    expect(result).toEqual({ id: 42, name: "Specific" });
    expect(specific).toHaveBeenCalledOnce();
    expect(catchAll).not.toHaveBeenCalled();
  });

  it("still throws ResolverError when no resolver (specific or catch-all) matches", async () => {
    const mesh = createMesh(multiEntitySchema);
    await expect(mesh.execute("{ user { id } }")).rejects.toThrow(
      "No resolver registered for entity 'user'",
    );
  });
});
