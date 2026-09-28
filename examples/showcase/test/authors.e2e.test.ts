import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createAuthClient } from "@meshql/client";
import { createApp } from "../src/app.js";
import { AUTHORS_QUERY } from "../src/web/AuthorsPanel.js";
import type { AuthorActivity } from "../src/web/types.js";

type Trace = { sql: Array<{ sql: string; params: unknown[] }> };

describe("showcase authors panel e2e", () => {
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

  async function readAuthors(email: string): Promise<{ authors: AuthorActivity[]; trace: Trace }> {
    let traceId: string | null = null;
    const client = createAuthClient({
      url: `${baseUrl}/mesh`,
      format: "json",
      fetch: async (input, init) => {
        const res = await fetch(input, init);
        const id = res.headers.get("x-showcase-trace");
        if (id) traceId = id;
        return res;
      },
    });
    await client.login({ email, password: "demo" });
    const data = (await client.query(AUTHORS_QUERY)) as {
      items: AuthorActivity[];
    };
    const res = await fetch(`${baseUrl}/showcase/sql/${traceId}`);
    return { authors: data.items, trace: (await res.json()) as Trace };
  }

  const postIds = (authors: AuthorActivity[], name: string) =>
    authors.find((a) => a.name === name)?.posts?.map((p) => p.id);

  it("returns each author's latest posts with comments grouped by day in one statement", async () => {
    const { authors, trace } = await readAuthors("admin@example.com");

    expect(authors.map((a) => a.name)).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(postIds(authors, "Ada Lovelace")).toEqual([6, 5, 4]);
    expect(postIds(authors, "Grace Hopper")).toEqual([8, 7, 3]);

    const post8 = authors[1]?.posts?.find((p) => p.id === 8);
    expect(post8?.comments?.map((d) => [d.date, d.count])).toEqual([
      ["2026-09-27", 2],
      ["2026-09-26", 2],
      ["2026-09-25", 1],
    ]);
    expect(post8?.comments?.[0]?.items[0]?.author?.name).toBeTruthy();

    expect(trace.sql).toHaveLength(1);
  });

  it("hides drafts inside the nested posts for guests", async () => {
    const { authors, trace } = await readAuthors("guest@example.com");

    expect(postIds(authors, "Ada Lovelace")).toEqual([5, 4, 1]);
    expect(authors.flatMap((a) => a.posts ?? []).every((p) => p.status === "published")).toBe(
      true,
    );
    expect(trace.sql).toHaveLength(1);
    expect(trace.sql[0]?.params).toContain("published");
  });
});
