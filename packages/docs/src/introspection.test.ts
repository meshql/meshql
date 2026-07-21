import { describe, expect, it } from "vitest";
import type { MeshSchema } from "@meshql/core";
import { buildSchemaDoc } from "./introspection.js";

const schema: MeshSchema = {
  entities: {
    user: {
      fields: ["id", "name", "firstName", "lastName"],
      computed: {
        fullName: {
          from: ["firstName", "lastName"],
          compute: (deps) => `${deps.firstName} ${deps.lastName}`,
          type: "string",
        },
      },
    },
    post: {
      fields: ["id", "title"],
    },
  },
  joins: {
    "user.posts": {
      entity: "post",
      on: "posts.user_id = users.id",
      type: "many",
    },
  },
};

describe("buildSchemaDoc", () => {
  it("lists entities, fields, and joins", () => {
    const doc = buildSchemaDoc(schema, { title: "Test API" });
    expect(doc.title).toBe("Test API");
    expect(doc.query).toMatchObject({
      formats: ["json", "ql"],
      controls: expect.arrayContaining(["$select", "$where", "$orderBy", "$page"]),
      filterOperators: expect.arrayContaining(["eq", "in", "ilike"]),
      aggregateFunctions: ["count", "sum", "avg", "min", "max"],
      pagination: { style: "keyset", defaultFirst: 50, maxFirst: 200 },
    });
    expect(doc.entities.map((e) => e.name)).toEqual(["post", "user"]);

    const user = doc.entities.find((e) => e.name === "user");
    expect(user?.fields).toEqual([
      { name: "id", kind: "scalar" },
      { name: "name", kind: "scalar" },
      { name: "firstName", kind: "scalar" },
      { name: "lastName", kind: "scalar" },
      { name: "fullName", kind: "computed", type: "string" },
    ]);
    expect(user?.joins).toEqual([
      { name: "posts", entity: "post", type: "many" },
    ]);
    expect(user?.listCapable).toBe(true);
  });

  it("filters entities with allowlist", () => {
    const doc = buildSchemaDoc(schema, { entities: ["user"] });
    expect(doc.entities).toHaveLength(1);
    expect(doc.entities[0]?.name).toBe("user");
  });
});
