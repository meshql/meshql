import { describe, expect, it, vi } from "vitest";
import { createMesh } from "@meshql/core";
import { withAccess } from "./index.js";

const schema = {
  entities: {
    user: { type: {}, fields: ["id", "email"], table: "users" },
    admin: { type: {}, fields: ["id"], table: "admins" },
  },
  joins: {},
};

describe("withAccess", () => {
  it("denies entity access with empty response", async () => {
    const mesh = createMesh(schema);
    withAccess(mesh, {
      entityAccess: {
        admin: (ctx) => ctx.role === "superadmin",
      },
    });

    const resolver = vi.fn(async () => ({ id: "1" }));
    mesh.resolve("admin", resolver);

    const result = await mesh.execute('{"admin":{"id":true}}', {
      format: "json",
      list: true,
      context: { requestId: "1", method: "GET", role: "user" },
    });

    expect(result).toEqual([]);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("denies row access for specific entityId", async () => {
    const mesh = createMesh(schema);
    withAccess(mesh, {
      rowAccess: {
        user: (ctx, entityId) => ctx.userId === entityId,
      },
    });

    const resolver = vi.fn(async () => ({ id: "1", email: "a@b.c" }));
    mesh.resolve("user", resolver);

    const result = await mesh.execute('{"user":{"id":true,"email":true}}', {
      format: "json",
      context: {
        requestId: "1",
        method: "GET",
        entityId: "other-user",
        userId: "me",
      },
    });

    expect(result).toEqual({});
    expect(resolver).not.toHaveBeenCalled();
  });

  it("strips fields via static rules", async () => {
    const mesh = createMesh(schema);
    withAccess(mesh, {
      rules: {
        "user.email": (ctx) => ctx.role !== "guest",
      },
    });

    mesh.resolve("user", async (plan) => {
      expect(plan.fields).not.toContain("users.email");
      return { id: "1" };
    });

    await mesh.execute('{"user":{"id":true,"email":true}}', {
      format: "json",
      context: { requestId: "1", method: "GET", role: "guest" },
    });
  });
});
