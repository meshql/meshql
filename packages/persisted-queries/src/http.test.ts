import { describe, expect, it } from "vitest";
import { createMesh } from "@meshql/core";
import { encodePersistedQuery, signPersistedQuery } from "@meshql/http";
import { createPersistedQueriesHandler, registerQuery } from "./index.js";
import { InMemoryQueryStore } from "./store.js";

describe("createPersistedQueriesHandler", () => {
  const schema = {
    entities: {
      user: { type: {}, fields: ["id", "name"], table: "users" },
    },
    joins: {},
  };

  it("registers and executes a persisted query by ID", async () => {
    const store = new InMemoryQueryStore();
    const mesh = createMesh(schema).resolve("user", async () => [
      { user_id: 1, user_name: "Ada" },
    ]);
    const handler = createPersistedQueriesHandler(mesh, { store });

    const raw = '{"user":{"id":true,"name":true}}';
    const registerResponse = await handler({
      method: "POST",
      path: "/mesh/queries",
      params: {},
      headers: {},
      body: { query: raw, format: "json" },
    });

    expect(registerResponse.status).toBe(200);
    const { id } = registerResponse.body as { id: string };

    const queryResponse = await handler({
      method: "GET",
      path: "/mesh/user",
      params: { entity: "user" },
      headers: encodePersistedQuery(id, "json"),
    });

    expect(queryResponse.status).toBe(200);
    expect(queryResponse.body).toEqual([{ id: 1, name: "Ada" }]);
  });

  it("supports signed persisted query headers", async () => {
    const store = new InMemoryQueryStore();
    const mesh = createMesh(schema).resolve("user", async () => [
      { user_id: 1, user_name: "Ada" },
    ]);
    const handler = createPersistedQueriesHandler(mesh, { store });

    const raw = '{"user":{"id":true}}';
    const id = registerQuery(store, raw, "json");
    const headers = signPersistedQuery(id, {
      format: "json",
      secret: "test-secret",
    });

    const queryResponse = await handler({
      method: "GET",
      path: "/mesh/user",
      params: { entity: "user" },
      headers,
    });

    expect(queryResponse.status).toBe(200);
    expect(queryResponse.body).toEqual([{ id: 1 }]);
  });
});
