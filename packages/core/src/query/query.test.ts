import { describe, expect, it } from "vitest";
import { parseQl } from "../parser/index.js";
import { astNodeToWire, normalizeReadTree } from "./normalize.js";
import { parseJsonQuery } from "./parse.js";

const schema = {
  entities: {
    post: {
      fields: ["id", "title", "status", "createdAt"],
      table: "posts",
      columns: { createdAt: "created_at" },
    },
    comment: {
      fields: ["id", "body"],
      table: "comments",
    },
  },
  joins: {
    "post.comments": {
      entity: "comment",
      on: "comments.post_id = posts.id",
      type: "many" as const,
    },
  },
};

describe("parseJsonQuery", () => {
  it("parses nested select with controls", () => {
    const doc = parseJsonQuery(
      JSON.stringify({
        post: {
          $select: {
            id: true,
            comments: {
              $select: { id: true, body: true },
              $page: { first: 5 },
            },
          },
          $where: { field: "status", op: "eq", value: "published" },
          $orderBy: [{ field: "createdAt", direction: "desc" }],
          $page: { first: 10 },
        },
      }),
    );
    expect(doc.root.name).toBe("post");
    expect(doc.root.page?.first).toBe(10);
    expect(doc.root.where).toMatchObject({ field: "status", op: "eq" });
  });

  it("normalizes collection controls and an id tiebreaker", () => {
    const doc = parseJsonQuery(
      JSON.stringify({
        post: {
          $select: { id: true },
          $page: { first: 1 },
        },
      }),
    );
    const { read } = normalizeReadTree(doc.root, schema);
    expect(read.page?.first).toBe(1);
    expect(
      read.orderBy.some(
        (entry) => "field" in entry && entry.field === "id",
      ),
    ).toBe(true);
  });
});

describe("QL and JSON selection equivalence", () => {
  it("normalizes to equivalent AST and default read controls", () => {
    const ql = normalizeReadTree(
      astNodeToWire(parseQl("{ post { id title comments { id body } } }").root),
      schema,
    );
    const json = normalizeReadTree(
      parseJsonQuery(
        JSON.stringify({
          post: {
            $select: {
              id: true,
              title: true,
              comments: { $select: { id: true, body: true } },
            },
          },
        }),
      ).root,
      schema,
    );

    expect(ql.ast).toEqual(json.ast);
    expect(ql.read.fields).toEqual(json.read.fields);
    expect(ql.read.refs.map((ref) => ref.name)).toEqual(
      json.read.refs.map((ref) => ref.name),
    );
    expect(ql.read.page?.first).toBe(json.read.page?.first);
    expect(ql.read.orderBy).toEqual(json.read.orderBy);
  });
});
