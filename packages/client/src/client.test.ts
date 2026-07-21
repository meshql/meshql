import { describe, expect, it, vi } from "vitest";
import { createClient } from "./client.js";

function decodeQuery(headers: HeadersInit | undefined): unknown {
  const encoded = new Headers(headers).get("X-Mesh-Query");
  if (!encoded) throw new Error("Missing X-Mesh-Query");
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function decodeRawQuery(headers: HeadersInit | undefined): string {
  const encoded = new Headers(headers).get("X-Mesh-Query");
  if (!encoded) throw new Error("Missing X-Mesh-Query");
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

describe("createClient.query", () => {
  it("transmits the canonical query object unchanged", async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(decodeQuery(init?.headers)).toEqual({
        user: {
          $select: {
            id: true,
            tokens: { $select: { accessToken: true } },
          },
          $where: { field: "active", op: "eq", value: true },
          $page: { first: 10 },
        },
      });
      return new Response(JSON.stringify({ items: [], pageInfo: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = createClient({ url: "https://example.test/mesh", fetch });
    await client.query({
      user: {
        $select: {
          id: true,
          tokens: { $select: { accessToken: true } },
        },
        $where: { field: "active", op: "eq", value: true },
        $page: { first: 10 },
      },
    });

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects root controls on a point read", async () => {
    const client = createClient({
      url: "https://example.test/mesh",
      fetch: vi.fn(),
    });

    await expect(
      client.query(
        {
          user: {
            $select: { id: true },
            $where: { field: "active", op: "eq", value: true },
          },
        },
        { entityId: "1" },
      ),
    ).rejects.toThrow("Cannot combine root read controls with `entityId`");
  });

  it("serializes selection-only queries as QL when format is ql", async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("X-Mesh-Format")).toBe("ql");
      expect(decodeRawQuery(init?.headers)).toBe(
        "{ user { id tokens { accessToken } } }",
      );
      return new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = createClient({
      url: "https://example.test/mesh",
      format: "ql",
      fetch,
    });

    await client.query(
      {
        user: {
          $select: {
            id: true,
            tokens: { $select: { accessToken: true } },
          },
        },
      },
      { entityId: "1" },
    );

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects nested controls when format is ql", async () => {
    const client = createClient({
      url: "https://example.test/mesh",
      format: "ql",
      fetch: vi.fn(),
    });

    await expect(
      client.query({
        user: {
          $select: {
            id: true,
            tokens: {
              $select: { accessToken: true },
              $page: { first: 5 },
            },
          },
        },
      }),
    ).rejects.toThrow("QL format is selection-only");
  });

  it("rejects root controls when format is ql", async () => {
    const client = createClient({
      url: "https://example.test/mesh",
      format: "ql",
      fetch: vi.fn(),
    });

    await expect(
      client.query({
        user: {
          $select: { id: true },
          $where: { field: "active", op: "eq", value: true },
        },
      }),
    ).rejects.toThrow("QL format is selection-only");
  });
});
