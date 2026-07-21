import { describe, expect, it, vi } from "vitest";
import {
  buildCursorFromRow,
  buildJoinPlan,
  createMesh,
  createQueryContext,
  normalizeReadTree,
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
      fields: ["id", "title", "body", "status", "createdAt"],
      table: "posts",
      columns: { createdAt: "created_at" },
    },
    comment: {
      fields: ["id", "body", "createdAt"],
      table: "comments",
      columns: { createdAt: "created_at" },
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
  it("maps keyset pagination to Prisma cursor + skip", () => {
    const readNode = {
      name: "post",
      select: { id: true, title: true },
      orderBy: [{ field: "createdAt", direction: "desc" as const }],
    };
    const { read: cursorRead } = normalizeReadTree(readNode, schema);
    const after = buildCursorFromRow(cursorRead, { createdAt: "2026-01-01", id: 5 })!;

    const { ast, read } = normalizeReadTree(
      { ...readNode, page: { first: 10, after } },
      schema,
    );
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
      { read },
    );

    // The normalized read appends an `id` tiebreaker to the sort keys; the
    // keyset cursor carries the id as its final value.
    expect(buildPrismaListArgs(plan, schema)).toEqual({
      take: 10,
      where: undefined,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
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
