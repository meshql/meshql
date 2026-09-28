import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createAuthClient, type MeshQuery } from "@meshql/client";
import { createApp } from "../src/app.js";

type Trace = { sql: Array<{ sql: string; params: unknown[] }> };

describe("showcase SQL trace e2e", () => {
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

  async function tracedRead(
    email: string,
    query: MeshQuery,
    options: { entityId?: string } = {},
  ): Promise<{ data: unknown; trace: Trace }> {
    let traceId: string | null = null;
    const client = createAuthClient({
      url: `${baseUrl}/mesh`,
      format: "json",
      fetch: async (input, init) => {
        const res = await fetch(input, init);
        traceId ??= res.headers.get("x-showcase-trace");
        return res;
      },
    });
    await client.login({ email, password: "demo" });
    const data = await client.query(query, options);
    expect(traceId).toBeTruthy();
    const res = await fetch(`${baseUrl}/showcase/sql/${traceId}`);
    expect(res.status).toBe(200);
    return { data, trace: (await res.json()) as Trace };
  }

  it("returns the executed SQL for a /mesh read", async () => {
    const { data, trace } = await tracedRead(
      "ada@example.com",
      { user: { $select: { id: true, name: true } } } as MeshQuery,
      { entityId: "1" },
    );
    expect(data).toMatchObject({ id: 1, name: "Ada Lovelace" });
    expect(trace.sql.length).toBeGreaterThan(0);
    expect(trace.sql[0]?.sql.toLowerCase()).toContain("select");
  });

  it("shows the guest published-only filter as a bound parameter", async () => {
    const { trace } = await tracedRead("guest@example.com", {
      post: { $select: { id: true, title: true } },
    } as MeshQuery);
    expect(trace.sql.flatMap((s) => s.params)).toContain("published");
  });

  it("404s for unknown trace ids", async () => {
    const res = await fetch(`${baseUrl}/showcase/sql/nope`);
    expect(res.status).toBe(404);
  });
});
