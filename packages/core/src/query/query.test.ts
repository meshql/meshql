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

describe("bucketed $groupBy and per-parent controls", () => {
  const read = (query: unknown) =>
    normalizeReadTree(parseJsonQuery(JSON.stringify(query)).root, schema).read;

  it("parses object-form group keys", () => {
    const doc = parseJsonQuery(
      JSON.stringify({
        post: {
          $select: { id: true },
          $groupBy: ["status", { field: "createdAt", bucket: "month", as: "month" }],
          $aggregate: { n: { fn: "count", field: "*" } },
        },
      }),
    );
    expect(doc.root.groupBy).toEqual([
      "status",
      { field: "createdAt", bucket: "month", as: "month" },
    ]);
  });

  it.each([
    [{ field: "createdAt", bucket: "decade" }, /bucket must be one of/],
    [{ field: "createdAt", as: "bad name" }, /as must be an identifier/],
    [{ field: "createdAt", extra: 1 }, /unknown key 'extra'/],
    [42, /must be a field name or an object/],
  ])("rejects malformed group key %j", (key, message) => {
    expect(() =>
      parseJsonQuery(
        JSON.stringify({ post: { $select: { id: true }, $groupBy: [key] } }),
      ),
    ).toThrow(message);
  });

  it("rejects non-identifier aggregate aliases", () => {
    expect(() =>
      parseJsonQuery(
        JSON.stringify({
          post: { $select: { id: true }, $groupBy: ["status"], $aggregate: { 'x"; --': { fn: "count" } } },
        }),
      ),
    ).toThrow(/must be an identifier/);
  });

  it("orders root aggregates by the group alias", () => {
    const node = read({
      post: {
        $select: { id: true },
        $groupBy: [{ field: "createdAt", bucket: "day", as: "day" }],
        $aggregate: { n: { fn: "count", field: "*" } },
      },
    });
    expect(node.orderBy).toEqual([{ field: "day", direction: "asc", nulls: "last" }]);
  });

  it("marks many-relations with explicit controls as perParent", () => {
    const node = read({
      post: {
        $select: {
          id: true,
          comments: { $select: { id: true }, $page: { first: 3 } },
        },
      },
    });
    expect(node.perParent).toBeUndefined();
    expect(node.refs[0]!.perParent).toBe(true);

    const plain = read({
      post: { $select: { id: true, comments: { $select: { id: true } } } },
    });
    expect(plain.refs[0]!.perParent).toBeUndefined();
  });

  it("keeps record order (with id tiebreaker) on nested grouped relations", () => {
    const node = read({
      post: {
        $select: {
          comments: {
            $select: { id: true },
            $groupBy: ["body"],
            $aggregate: { n: { fn: "count", field: "*" } },
          },
        },
      },
    });
    expect(node.refs[0]!.mode).toBe("aggregate");
    expect(node.refs[0]!.orderBy).toEqual([{ field: "id", direction: "asc", nulls: "last" }]);
  });

  it("rejects $having on nested relations", () => {
    expect(() =>
      read({
        post: {
          $select: {
            comments: {
              $select: { id: true },
              $groupBy: ["body"],
              $having: { aggregate: "n", op: "gt", value: 1 },
            },
          },
        },
      }),
    ).toThrow(/'\$having' is not supported on nested relation/);
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
