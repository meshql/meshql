import { describe, expect, it, vi } from "vitest";
import {
  buildJoinPlan,
  createMesh,
  createQueryContext,
  parseQl,
  type MeshSchema,
} from "@meshql/core";
import {
  buildPrismaListArgs,
  buildPrismaSelect,
  buildPrismaWhere,
  prismaResolver,
} from "./index.js";

const schema: MeshSchema = {
  entities: {
    post: {
      type: {},
      fields: ["id", "title", "body", "status", "createdAt"],
      table: "posts",
      columns: { createdAt: "created_at" },
    },
    comment: {
      type: {},
      fields: ["id", "body", "createdAt"],
      table: "comments",
      columns: { createdAt: "created_at" },
    },
    user: {
      type: {},
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

describe("buildPrismaSelect", () => {
  it("maps root scalars and nested relations", () => {
    const ast = parseQl(
      "{ post { id title comments { body author { name } } } }",
    );
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "1" }),
    );

    expect(buildPrismaSelect(plan, schema)).toEqual({
      id: true,
      title: true,
      comments: {
        select: {
          body: true,
          id: true,
          author: {
            select: {
              name: true,
              id: true,
            },
          },
        },
      },
    });
  });
});

describe("buildPrismaWhere", () => {
  it("maps point reads to a primary-key where", () => {
    const ast = parseQl("{ post { id } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "42" }),
    );

    expect(buildPrismaWhere(plan, schema)).toEqual({ id: 42 });
  });
});

describe("buildPrismaListArgs", () => {
  it("maps cursor pagination to Prisma cursor + skip", () => {
    const ast = parseQl("{ post { id title } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
      {
        list: {
          limit: 10,
          cursor: Buffer.from(JSON.stringify({ id: 5 }), "utf8").toString(
            "base64url",
          ),
          orderBy: [{ field: "createdAt", dir: "desc" }],
        },
      },
    );

    expect(buildPrismaListArgs(plan, schema)).toEqual({
      take: 10,
      where: undefined,
      orderBy: { created_at: "desc" },
      cursor: { id: 5 },
      skip: 1,
    });
  });
});

describe("prismaResolver", () => {
  it("calls findUnique for point reads and returns preshaped rows", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 1,
      title: "Hello",
      comments: [{ id: 10, body: "hi", author: { id: 2, name: "Ada" } }],
    });
    const findMany = vi.fn();

    const mesh = createMesh(schema);
    mesh.resolve("*", prismaResolver(
      { post: { findUnique, findMany } },
      { schema },
    ), { preshaped: true });

    const result = await mesh.execute("{ post { id title comments { body author { name } } } }", {
      context: { requestId: "1", method: "GET", entityId: "1" },
    });

    expect(findUnique).toHaveBeenCalledOnce();
    expect(findMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 1,
      title: "Hello",
      comments: [{ id: 10, body: "hi", author: { id: 2, name: "Ada" } }],
    });
  });
});
