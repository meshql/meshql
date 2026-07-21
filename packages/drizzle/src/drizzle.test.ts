import { describe, expect, it, vi } from "vitest";
import {
  buildJoinPlan,
  createMesh,
  createQueryContext,
  parseQl,
  type MeshSchema,
} from "@meshql/core";
import { buildDrizzleQuery, drizzleQueryKey, drizzleResolver } from "./index.js";

const schema: MeshSchema = {
  entities: {
    post: {
      fields: ["id", "title"],
      table: "posts",
    },
    comment: {
      fields: ["id", "body"],
      table: "comments",
    },
    user: {
      fields: ["id", "name"],
      table: "users",
    },
  },
  joins: {
    "post.comments": {
      entity: "comment",
      on: "comments.post_id = posts.id",
      type: "many",
    },
    "comments.author": {
      entity: "user",
      on: "users.id = comments.author_id",
      type: "one",
    },
  },
};

describe("buildDrizzleQuery", () => {
  it("maps nested with/columns", () => {
    const ast = parseQl("{ post { id comments { body author { name } } } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(buildDrizzleQuery(plan, schema)).toEqual({
      columns: { id: true },
      with: {
        comments: {
          columns: { body: true, id: true },
          with: {
            author: {
              columns: { name: true, id: true },
            },
          },
        },
      },
    });
  });
});

describe("drizzleQueryKey", () => {
  it("uses the entity table name", () => {
    expect(drizzleQueryKey("post", schema)).toBe("posts");
  });
});

describe("drizzleResolver", () => {
  it("queries db.query.posts for the post entity", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 1,
      comments: [{ body: "hi", author: { name: "Ada" } }],
    });
    const findMany = vi.fn();

    const mesh = createMesh(schema);
    mesh.resolve(
      "*",
      drizzleResolver({ query: { posts: { findFirst, findMany } } }, { schema }),
      { preshaped: true },
    );

    const result = await mesh.execute(
      "{ post { id comments { body author { name } } } }",
      {
        format: "ql",
        context: { requestId: "1", method: "GET", entityId: "1" },
      },
    );

    expect(findFirst).toHaveBeenCalledOnce();
    expect(result).toEqual({
      id: 1,
      comments: [{ body: "hi", author: { name: "Ada" } }],
    });
  });
});
