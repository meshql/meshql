import { describe, expect, it } from "vitest";
import { extendSchema } from "./extend-schema.js";
import type { MeshSchema } from "./schema.js";

const base: MeshSchema = {
  entities: {
    user: {
      type: {},
      fields: ["id", "name", "email"],
      table: "users",
      columns: { email: "email_address" },
    },
    post: {
      type: {},
      fields: ["id", "title"],
      table: "posts",
    },
  },
  joins: {
    "user.posts": {
      entity: "post",
      on: "posts.author_id = users.id",
      type: "many",
    },
  },
};

describe("extendSchema", () => {
  it("hides fields by replacing the fields array", () => {
    const schema = extendSchema(base, {
      entities: { user: { fields: ["id", "name"] } },
    });

    expect(schema.entities.user!.fields).toEqual(["id", "name"]);
    expect(schema.entities.user!.table).toBe("users");
    expect(base.entities.user!.fields).toEqual(["id", "name", "email"]);
  });

  it("adds custom joins without mutating the original", () => {
    const schema = extendSchema(base, {
      joins: {
        "user.publicPosts": {
          entity: "post",
          on: "posts.author_id = users.id AND posts.public = true",
          type: "many",
        },
      },
    });

    expect(schema.joins["user.publicPosts"]?.type).toBe("many");
    expect(schema.joins["user.posts"]).toBeDefined();
    expect(base.joins["user.publicPosts"]).toBeUndefined();
  });

  it("removes joins when override sets undefined", () => {
    const schema = extendSchema(base, {
      joins: { "user.posts": undefined },
    });

    expect(schema.joins["user.posts"]).toBeUndefined();
  });

  it("preserves columns unless overridden", () => {
    const schema = extendSchema(base, {
      entities: { user: { fields: ["id"] } },
    });
    expect(schema.entities.user!.columns).toEqual({ email: "email_address" });

    const replaced = extendSchema(base, {
      entities: { user: { fields: ["id"], columns: { id: "user_id" } } },
    });
    expect(replaced.entities.user!.columns).toEqual({ id: "user_id" });
  });
});
