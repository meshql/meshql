import { describe, expect, it } from "vitest";
import {
  entityIdField,
  entityTable,
  resolveEntityKey,
} from "./schema.js";
import type { MeshSchema } from "./schema.js";

describe("entityTable", () => {
  it("appends 's' when the name doesn't already end in one", () => {
    expect(entityTable("user")).toBe("users");
  });

  it("leaves a trailing 's' alone", () => {
    expect(entityTable("users")).toBe("users");
  });

  it("respects config.table override for irregular plurals", () => {
    expect(entityTable("address", { fields: [], table: "addresses" })).toBe(
      "addresses",
    );
    expect(entityTable("story", { fields: [], table: "stories" })).toBe(
      "stories",
    );
  });
});

describe("entityIdField", () => {
  it("defaults to 'id'", () => {
    expect(entityIdField()).toBe("id");
    expect(entityIdField({ fields: [] })).toBe("id");
  });

  it("respects a config override", () => {
    expect(entityIdField({ fields: [], idField: "uuid" })).toBe("uuid");
  });
});

describe("resolveEntityKey", () => {
  const schema: MeshSchema = {
    entities: {
      user: { fields: ["id"] },
      address: { fields: ["id"], table: "addresses" },
      category: { fields: ["id"], table: "categories" },
    },
    joins: {},
  };

  it("returns the exact entity key when it matches", () => {
    expect(resolveEntityKey("user", schema)).toBe("user");
    expect(resolveEntityKey("address", schema)).toBe("address");
  });

  it("resolves the SQL table name back to the entity key (regular plural)", () => {
    expect(resolveEntityKey("users", schema)).toBe("user");
  });

  it("resolves an irregular plural via config.table", () => {
    expect(resolveEntityKey("addresses", schema)).toBe("address");
    expect(resolveEntityKey("categories", schema)).toBe("category");
  });

  it("returns undefined for names that don't map to any entity", () => {
    expect(resolveEntityKey("ghost", schema)).toBeUndefined();
    // The naive fallback only handles `+s`, so an irregular plural without
    // a `table` override is not resolvable \u2014 users must declare it.
    expect(resolveEntityKey("categorie", schema)).toBeUndefined();
  });

  it("falls back to naive singularization for legacy regular plurals", () => {
    const legacy: MeshSchema = {
      entities: { post: { fields: ["id"] } },
      joins: {},
    };
    expect(resolveEntityKey("posts", legacy)).toBe("post");
  });
});
