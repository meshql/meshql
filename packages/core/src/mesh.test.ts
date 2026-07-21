import { describe, expect, it, vi } from "vitest";
import { createMesh } from "./index.js";
import type { CollectionResult, JoinPlan, MeshConfig, Resolver } from "./index.js";

const schema: MeshConfig = {
  entities: {
    user: { fields: ["id", "name", "createdAt"] },
  },
  joins: {},
};

function fakeResolver(rows: Record<string, unknown>[]): Resolver {
  return vi.fn(async () => rows);
}

describe("createMesh — collection reads", () => {
  it("passes read controls from the JSON wire payload down to the resolver", async () => {
    const resolver = fakeResolver([{ user_id: 1, user_name: "Ada" }]);
    const mesh = createMesh(schema).resolve("user", resolver);

    const wire = JSON.stringify({
      user: {
        id: true,
        name: true,
        $where: { field: "id", op: "gt", value: 100 },
        $orderBy: [{ field: "name", direction: "asc" }],
        $page: { first: 10 },
      },
    });

    const result = await mesh.execute(wire, { format: "json" });

    expect(resolver).toHaveBeenCalledOnce();
    const plan = (resolver as unknown as { mock: { calls: [JoinPlan][] } }).mock
      .calls[0]![0];
    expect(plan.read?.where).toEqual({ field: "id", op: "gt", value: 100 });
    expect(plan.read?.page?.first).toBe(10);
    // Collection reads return an envelope.
    const collection = result as CollectionResult<Record<string, unknown>>;
    expect(Array.isArray(collection.items)).toBe(true);
    expect(collection.pageInfo).toBeDefined();
  });

  it("explicit list: false returns a single record", async () => {
    const resolver = fakeResolver([{ user_id: 1, user_name: "Ada" }]);
    const mesh = createMesh(schema).resolve("user", resolver);

    const wire = JSON.stringify({ user: { id: true, name: true } });
    const result = await mesh.execute(wire, { format: "json", list: false });

    expect(Array.isArray(result)).toBe(false);
    expect(result).toEqual({ id: 1, name: "Ada" });
  });

  it("propagates validation errors for oversized pages", async () => {
    const mesh = createMesh(schema).resolve("user", fakeResolver([]));

    const wire = JSON.stringify({
      user: { id: true, $page: { first: 9999 } },
    });

    await expect(mesh.execute(wire, { format: "json" })).rejects.toThrow(
      /page\.first .* exceeds maximum/,
    );
  });
});

describe("createMesh — catch-all resolver", () => {
  const multiEntitySchema: MeshConfig = {
    entities: {
      user: { fields: ["id", "name"] },
      post: { fields: ["id", "title"] },
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

    const user = await mesh.execute("{ user { id name } }", { list: false });
    expect(user).toEqual({ id: 1, name: "Ada" });

    const post = await mesh.execute("{ post { id title } }", { list: false });
    expect(post).toEqual({ id: 1, title: "Hi" });

    expect(catchAll).toHaveBeenCalledTimes(2);
  });

  it("prefers a specific resolver over the catch-all", async () => {
    const specific = vi.fn(async () => ({ user_id: 42, user_name: "Specific" }));
    const catchAll = vi.fn(async () => ({ user_id: 0, user_name: "Catch" }));

    const mesh = createMesh(multiEntitySchema)
      .resolve("user", specific)
      .resolve("*", catchAll);

    const result = await mesh.execute("{ user { id name } }", { list: false });

    expect(result).toEqual({ id: 42, name: "Specific" });
    expect(specific).toHaveBeenCalledOnce();
    expect(catchAll).not.toHaveBeenCalled();
  });

  it("still throws ResolverError when no resolver (specific or catch-all) matches", async () => {
    const mesh = createMesh(multiEntitySchema);
    await expect(mesh.execute("{ user { id } }", { list: false })).rejects.toThrow(
      "No resolver registered for entity 'user'",
    );
  });
});

describe("createMesh — preshaped resolvers", () => {
  it("skips the shaper when preshaped: true", async () => {
    const mesh = createMesh(schema).resolve(
      "user",
      vi.fn(async () => ({
        id: 1,
        name: "Ada",
        nested: { already: "shaped" },
      })),
      { preshaped: true },
    );

    const result = await mesh.execute("{ user { id name } }", { list: false });
    expect(result).toEqual({
      id: 1,
      name: "Ada",
      nested: { already: "shaped" },
    });
  });
});
