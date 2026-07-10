import { describe, expect, it, vi } from "vitest";
import { createMesh } from "@meshql/core";
import { withAccessCache } from "./index.js";
import { InMemoryAccessCacheStore } from "./store.js";

const schema = {
  entities: {
    user: { type: {}, fields: ["id", "email"], table: "users" },
    post: { type: {}, fields: ["id", "title"], table: "posts" },
  },
  joins: {},
};

describe("withAccessCache", () => {
  it("caches static field rule results per principal", async () => {
    const store = new InMemoryAccessCacheStore();
    const rule = vi.fn((ctx: { role?: string }) => ctx.role !== "guest");
    const mesh = createMesh(schema);
    withAccessCache(
      mesh,
      {
        rules: {
          "user.email": rule,
        },
      },
      { store, ttlSeconds: 60 },
    );

    mesh.resolve("user", async (plan) => {
      expect(plan.fields).not.toContain("users.email");
      return { id: "1" };
    });

    const context = { requestId: "1", method: "GET" as const, role: "guest" };

    await mesh.execute('{"user":{"id":true,"email":true}}', {
      format: "json",
      context,
    });
    await mesh.execute('{"user":{"id":true,"email":true}}', {
      format: "json",
      context,
    });

    expect(rule).toHaveBeenCalledTimes(1);
  });

  it("caches row access decisions", async () => {
    const store = new InMemoryAccessCacheStore();
    const rowRule = vi.fn(async (_ctx, entityId: string) => entityId === "42");
    const mesh = createMesh(schema);
    withAccessCache(
      mesh,
      {
        rowAccess: {
          post: rowRule,
        },
      },
      { store },
    );

    const resolver = vi.fn(async () => ({ id: "42", title: "Hello" }));
    mesh.resolve("post", resolver);

    const context = {
      requestId: "1",
      method: "GET" as const,
      entityId: "42",
      userId: "7",
    };

    await mesh.execute('{"post":{"id":true,"title":true}}', {
      format: "json",
      context,
    });
    await mesh.execute('{"post":{"id":true,"title":true}}', {
      format: "json",
      context,
    });

    expect(rowRule).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached permissions for a user", async () => {
    const store = new InMemoryAccessCacheStore();
    const rowRule = vi.fn(async () => true);
    const mesh = createMesh(schema);
    const { invalidate } = withAccessCache(
      mesh,
      {
        rowAccess: {
          post: rowRule,
        },
      },
      { store },
    );

    mesh.resolve("post", async () => ({ id: "42", title: "Hello" }));

    const context = {
      requestId: "1",
      method: "GET" as const,
      entityId: "42",
      userId: "7",
    };

    await mesh.execute('{"post":{"id":true,"title":true}}', {
      format: "json",
      context,
    });
    await invalidate.invalidateUser("7");
    await mesh.execute('{"post":{"id":true,"title":true}}', {
      format: "json",
      context,
    });

    expect(rowRule).toHaveBeenCalledTimes(2);
  });
});
