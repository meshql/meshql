import { createMesh, type MeshSchema } from "@meshql/core";
import { describe, expect, it, vi } from "vitest";
import { createHttpHandler } from "./index.js";
import { encodeQuery } from "./transport/decode.js";

const schema: MeshSchema = {
  entities: {
    user: { fields: ["id", "name"] },
  },
  joins: {},
};

function createTestMesh() {
  return createMesh(schema).resolve("user", async () => [
    { user_id: 1, user_name: "Ada" },
  ]);
}

describe("HTTP handlers — query formats", () => {
  it("accepts GET with X-Mesh-Format: ql", async () => {
    const handler = createHttpHandler(createTestMesh());
    const headers = encodeQuery("{ user { id name } }", "ql");

    const result = await handler({
      method: "GET",
      params: { entity: "user", id: "1" },
      headers,
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ id: 1, name: "Ada" });
  });

  it("accepts POST with explicit QL format", async () => {
    const handler = createHttpHandler(createTestMesh());

    const result = await handler({
      method: "POST",
      params: {},
      headers: {},
      body: {
        query: "{ user { id name } }",
        format: "ql",
      },
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      items: [{ id: 1, name: "Ada" }],
    });
  });

  it("defaults POST body format to json", async () => {
    const handler = createHttpHandler(createTestMesh());

    const result = await handler({
      method: "POST",
      params: {},
      headers: {},
      body: {
        query: JSON.stringify({
          user: { $select: { id: true, name: true } },
        }),
      },
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      items: [{ id: 1, name: "Ada" }],
    });
  });

  it("returns 400 for malformed QL on GET", async () => {
    const handler = createHttpHandler(createTestMesh());
    const headers = encodeQuery("{ user { id, name } }", "ql");

    const result = await handler({
      method: "GET",
      params: { entity: "user", id: "1" },
      headers,
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: "ParseError",
    });
  });

  it("resolves persisted QL queries", async () => {
    const resolveQueryId = vi.fn((id: string) =>
      id === "q_ql_user"
        ? { raw: "{ user { id name } }", format: "ql" as const }
        : undefined,
    );
    const handler = createHttpHandler(createTestMesh(), { resolveQueryId });

    const result = await handler({
      method: "GET",
      params: { entity: "user", id: "1" },
      headers: {
        "X-Mesh-Query-Id": "q_ql_user",
        "X-Mesh-Format": "ql",
      },
    });

    expect(resolveQueryId).toHaveBeenCalledWith("q_ql_user");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ id: 1, name: "Ada" });
  });
});
