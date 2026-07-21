import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";

describe("showcase /docs e2e", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected TCP address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GET /docs serves playground HTML", async () => {
    const res = await fetch(`${baseUrl}/docs`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("MeshQL Playground");
    expect(html).toContain("MeshQL Showcase");
  });

  it("GET /docs/schema returns showcase entities", async () => {
    const res = await fetch(`${baseUrl}/docs/schema`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      title?: string;
      entities: Array<{ name: string; fields: unknown[]; joins: unknown[] }>;
    };
    expect(body.title).toBe("MeshQL Showcase");
    const names = body.entities.map((e) => e.name).sort();
    expect(names).toEqual(["comment", "post", "user"]);
    const user = body.entities.find((e) => e.name === "user");
    expect(user?.fields.length).toBeGreaterThan(0);
    expect(user?.joins.length).toBeGreaterThan(0);
  });

  it("POST /docs/execute runs a query with plan + SQL meta", async () => {
    const res = await fetch(`${baseUrl}/docs/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: JSON.stringify({
          user: { id: true, name: true },
        }),
        format: "json",
        context: { entityId: "1" },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { id: number; name: string };
      meta: {
        durationMs: number;
        plan?: { rootEntity: string };
        sql?: Array<{ sql: string; params: unknown[] }>;
      };
    };
    expect(body.data).toMatchObject({ id: 1, name: "Ada Lovelace" });
    expect(body.meta.durationMs).toBeGreaterThanOrEqual(0);
    expect(body.meta.plan?.rootEntity).toBe("user");
    expect(body.meta.sql?.length).toBeGreaterThan(0);
    expect(body.meta.sql?.[0]?.sql.toLowerCase()).toContain("select");
  });

  it("POST /docs/execute resolves nested posts.author join key", async () => {
    const res = await fetch(`${baseUrl}/docs/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: JSON.stringify({
          user: {
            id: true,
            posts: {
              id: true,
              title: true,
              author: { id: true, name: true },
            },
          },
        }),
        format: "json",
        context: { entityId: "1" },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        id: number;
        posts: Array<{ id: number; author: { id: number; name: string } }>;
      };
      meta: { plan?: { joins?: Array<{ path: string }> } };
    };
    expect(body.data.id).toBe(1);
    expect(body.data.posts.length).toBeGreaterThan(0);
    expect(body.data.posts[0]?.author).toMatchObject({
      id: 1,
      name: "Ada Lovelace",
    });
    expect(body.meta.plan?.joins?.map((j) => j.path)).toEqual(
      expect.arrayContaining(["posts", "posts.author"]),
    );
  });
});
