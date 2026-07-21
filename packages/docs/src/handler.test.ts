import { describe, expect, it } from "vitest";
import { createMesh } from "@meshql/core";
import { createDocsHandler } from "./index.js";

const schema = {
  entities: {
    user: { fields: ["id", "name"], table: "users" },
  },
  joins: {},
};

describe("createDocsHandler", () => {
  const mesh = createMesh(schema);
  mesh.resolve("*", async () => [{ user_id: 1, user_name: "Ada" }]);

  const handler = createDocsHandler(mesh, {
    path: "/docs",
    title: "Test",
    auth: false,
    sql: false,
  });

  it("serves schema JSON", async () => {
    const result = await handler({
      method: "GET",
      path: "/docs/schema",
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      title: "Test",
      entities: [{ name: "user" }],
    });
  });

  it("executes queries via POST /docs/execute", async () => {
    const result = await handler({
      method: "POST",
      path: "/docs/execute",
      body: {
        query: JSON.stringify({
          user: { $select: { id: true, name: true } },
        }),
        format: "json",
      },
    });
    expect(result.status).toBe(200);
    const body = result.body as {
      data: { items: unknown[] };
      meta: { durationMs: number };
    };
    expect(body.data.items).toEqual([{ id: 1, name: "Ada" }]);
    expect(body.meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("serves playground HTML at /docs", async () => {
    const result = await handler({
      method: "GET",
      path: "/docs",
    });
    expect(result.status).toBe(200);
    expect(result.headers?.["content-type"]).toContain("text/html");
    const html = String(result.body);
    expect(html).toContain("MeshQL Playground");
    expect(html).toContain("Read controls");
    expect(html).toContain("$where · $orderBy · $page · aggregates");
    expect(html).toContain("data-preset=\"aggregate\"");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script!)).not.toThrow();
  });
});
