/**
 * End-to-end tests for the nested fetch strategy (per-parent relation
 * controls and bucketed `$groupBy`) against Node's built-in `node:sqlite`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createMesh,
  type CollectionResult,
  type JoinPlan,
  type MeshSchema,
} from "@meshql/core";
import { buildSelectSql } from "./builder.js";

let DatabaseSync: typeof import("node:sqlite").DatabaseSync | undefined;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = undefined;
}

const describeIfSqlite = DatabaseSync ? describe : describe.skip;

type SqliteParam = null | number | bigint | string | Uint8Array;
type Row = Record<string, unknown>;

const schema: MeshSchema = {
  entities: {
    user: { fields: ["id", "name"], table: "users" },
    post: {
      fields: ["id", "title", "score", "userId"],
      table: "posts",
      columns: { userId: "user_id" },
      computed: {
        shout: {
          from: ["title"],
          compute: ({ title }) => String(title).toUpperCase(),
        },
      },
    },
    comment: {
      fields: ["id", "body", "createdAt", "postId", "authorId"],
      table: "comments",
      columns: { createdAt: "created_at", postId: "post_id", authorId: "author_id" },
    },
    tag: { fields: ["id", "label"], table: "tags" },
  },
  joins: {
    "user.posts": { entity: "post", on: "posts.user_id = users.id", type: "many" },
    "post.comments": {
      entity: "comment",
      on: "comments.post_id = posts.id",
      type: "many",
    },
    "comment.author": {
      entity: "user",
      on: "users.id = comments.author_id",
      type: "one",
    },
    "post.tags": {
      entity: "tag",
      on: "",
      type: "many",
      through: { table: "post_tags", from: "post_id", to: "tag_id" },
    },
  },
};

function seed() {
  const db = new DatabaseSync!(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL,
      title TEXT NOT NULL, score INTEGER NOT NULL
    );
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, author_id INTEGER NOT NULL,
      body TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE tags (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
    CREATE TABLE post_tags (post_id INTEGER NOT NULL, tag_id INTEGER NOT NULL);

    INSERT INTO users (id, name) VALUES (1, 'Ada'), (2, 'Grace'), (3, 'Linus');
    INSERT INTO tags (id, label) VALUES (1, 'math'), (2, 'engines');
  `);

  // Ada: 7 posts (scores 10..70), Grace: 2 posts, Linus: none.
  const insertPost = db.prepare("INSERT INTO posts (id, user_id, title, score) VALUES (?, ?, ?, ?)");
  for (let i = 1; i <= 7; i++) insertPost.run(i, 1, `ada post ${i}`, i * 10);
  insertPost.run(8, 2, "grace post 8", 5);
  insertPost.run(9, 2, "grace post 9", 50);

  // Post 7 (Ada's best): 12 comments over 3 days, 4 per day.
  const insertComment = db.prepare(
    "INSERT INTO comments (id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  let id = 1;
  for (const day of ["2026-09-26", "2026-09-27", "2026-09-28"]) {
    for (let h = 10; h < 14; h++) {
      insertComment.run(id, 7, (id % 2) + 1, `c${id}`, `${day}T${h}:00:00Z`);
      id++;
    }
  }
  insertComment.run(id++, 9, 1, "on grace", "2026-09-20T08:00:00Z");

  db.exec("INSERT INTO post_tags (post_id, tag_id) VALUES (7, 1), (7, 2), (6, 2)");
  return db;
}

function meshFor(db: InstanceType<NonNullable<typeof DatabaseSync>>) {
  const mesh = createMesh(schema);
  const plans: JoinPlan[] = [];
  const sqls: string[] = [];
  const resolver = async (plan: JoinPlan) => {
    plans.push(plan);
    const { sql, params } = buildSelectSql(plan, schema);
    sqls.push(sql);
    return db.prepare(sql).all(...(params as SqliteParam[]));
  };
  mesh.resolve("user", resolver);
  mesh.resolve("post", resolver);
  mesh.resolve("comment", resolver);
  return { mesh, plans, sqls };
}

/** Users, their top 5 posts, and each post's last 10 comments bucketed by day. */
const topPostsQuery = JSON.parse(
  readFileSync(
    new URL("../../../specs/fixtures/queries/nested-per-parent.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

describeIfSqlite("nested fetch strategy against node:sqlite", () => {
  it("returns users, their top 5 posts, and the last 10 comments bucketed by day", async () => {
    const { mesh, plans } = meshFor(seed());
    const result = (await mesh.execute(JSON.stringify(topPostsQuery))) as CollectionResult<Row>;

    expect(plans[0]!.strategy).toBe("nested");
    expect(result.items.map((user) => user.name)).toEqual(["Ada", "Grace", "Linus"]);

    const [ada, grace, linus] = result.items as Row[];
    const adaPosts = ada!.posts as Row[];
    expect(adaPosts.map((post) => post.score)).toEqual([70, 60, 50, 40, 30]);
    expect((grace!.posts as Row[]).map((post) => post.id)).toEqual([9, 8]);
    expect(linus!.posts).toEqual([]);

    const buckets = adaPosts[0]!.comments as Row[];
    // Last 10 of 12 comments: all of 09-28 and 09-27, two of 09-26.
    expect(buckets.map((bucket) => [bucket.date, bucket.count])).toEqual([
      ["2026-09-28", 4],
      ["2026-09-27", 4],
      ["2026-09-26", 2],
    ]);
    expect((buckets[0]!.items as Row[]).map((comment) => comment.id)).toEqual([12, 11, 10, 9]);
    expect(buckets[2]!.items).toEqual([
      { id: 4, createdAt: "2026-09-26T13:00:00Z" },
      { id: 3, createdAt: "2026-09-26T12:00:00Z" },
    ]);
    expect(adaPosts[1]!.comments).toEqual([]);
  });

  it("limits the root page by users, not by joined rows", async () => {
    const { mesh } = meshFor(seed());
    const query = {
      user: {
        $select: {
          id: true,
          posts: { $select: { id: true }, $orderBy: [{ field: "id", direction: "asc" }] },
        },
        $page: { first: 1 },
      },
    };
    const result = (await mesh.execute(JSON.stringify(query))) as CollectionResult<Row>;
    expect(result.items).toEqual([
      { id: 1, posts: [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id })) },
    ]);
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  it("applies nested $where per parent", async () => {
    const { mesh } = meshFor(seed());
    const query = {
      user: {
        $select: {
          name: true,
          posts: {
            $select: { id: true },
            $where: { field: "score", op: "gte", value: 50 },
          },
        },
        $where: { field: "id", op: "lte", value: 2 },
      },
    };
    const result = (await mesh.execute(JSON.stringify(query))) as CollectionResult<Row>;
    expect(result.items).toEqual([
      { name: "Ada", posts: [{ id: 5 }, { id: 6 }, { id: 7 }] },
      { name: "Grace", posts: [{ id: 9 }] },
    ]);
  });

  it("nests one-relations, many-to-many joins and computed fields inside nested reads", async () => {
    const { mesh } = meshFor(seed());
    const query = {
      post: {
        $select: {
          id: true,
          shout: true,
          tags: { $select: { label: true } },
          comments: {
            $select: { id: true, author: { $select: { name: true } } },
            $orderBy: [{ field: "id", direction: "asc" }],
            $page: { first: 2 },
          },
        },
        $where: { field: "id", op: "in", value: [6, 7] },
      },
    };
    const result = (await mesh.execute(JSON.stringify(query))) as CollectionResult<Row>;
    expect(result.items).toEqual([
      { id: 6, shout: "ADA POST 6", tags: [{ label: "engines" }], comments: [] },
      {
        id: 7,
        shout: "ADA POST 7",
        tags: [{ label: "math" }, { label: "engines" }],
        comments: [
          { id: 1, author: { name: "Grace" } },
          { id: 2, author: { name: "Ada" } },
        ],
      },
    ]);
  });

  it("supports point reads", async () => {
    const { mesh } = meshFor(seed());
    const query = {
      user: {
        $select: {
          name: true,
          posts: { $select: { id: true }, $orderBy: [{ field: "score", direction: "desc" }], $page: { first: 2 } },
        },
      },
    };
    const result = await mesh.execute(JSON.stringify(query), {
      context: { requestId: "1", method: "GET", entityId: "2" },
    });
    expect(result).toEqual({ name: "Grace", posts: [{ id: 9 }, { id: 8 }] });
  });

  it("keeps the flat strategy when no relation has per-parent controls", async () => {
    const { mesh, plans, sqls } = meshFor(seed());
    await mesh.execute(
      JSON.stringify({ user: { $select: { id: true, posts: { $select: { id: true } } } } }),
    );
    expect(plans[0]!.strategy).toBe("flat");
    expect(plans[0]!.rowFormat).toBeUndefined();
    expect(sqls[0]).toContain("LEFT JOIN posts AS posts");
  });

  it("buckets root aggregates by day", async () => {
    const { mesh } = meshFor(seed());
    const query = {
      comment: {
        $select: { id: true },
        $groupBy: [{ field: "createdAt", bucket: "day", as: "day" }],
        $aggregate: { total: { fn: "count", field: "*" } },
        $orderBy: [{ field: "day", direction: "desc" }],
        $page: { first: 2 },
      },
    };
    const result = (await mesh.execute(JSON.stringify(query))) as CollectionResult<Row>;
    expect(result.items).toEqual([
      { day: "2026-09-28", total: 4 },
      { day: "2026-09-27", total: 4 },
    ]);
  });

  it("works without ORDER BY inside aggregates (SQLite < 3.44 fallback)", async () => {
    const db = seed();
    const mesh = createMesh(schema);
    mesh.resolve("user", async (plan) => {
      const { sql, params } = buildSelectSql(plan, schema, { aggregateOrderBy: false });
      expect(sql).not.toMatch(/json_group_array\([^)]*ORDER BY/);
      return db.prepare(sql).all(...(params as SqliteParam[]));
    });
    const result = (await mesh.execute(JSON.stringify(topPostsQuery))) as CollectionResult<Row>;
    const adaPosts = result.items[0]!.posts as Row[];
    expect(adaPosts.map((post) => post.score)).toEqual([70, 60, 50, 40, 30]);
    expect((adaPosts[0]!.comments as Row[]).map((bucket) => bucket.date)).toEqual([
      "2026-09-28",
      "2026-09-27",
      "2026-09-26",
    ]);
  });

  it.each([
    [
      "nested cursors",
      { user: { $select: { posts: { $select: { id: true }, $page: { first: 1, after: "x" } } } } },
      /only supported on the root/,
    ],
    [
      "nested aggregates without groupBy",
      {
        user: {
          $select: { posts: { $select: { id: true }, $aggregate: { n: { fn: "count", field: "*" } } } },
        },
      },
      /requires '\$groupBy'/,
    ],
    [
      "grouping on one-relations",
      {
        comment: {
          $select: { author: { $select: { name: true }, $groupBy: ["name"] } },
        },
      },
      /not allowed on one-relation/,
    ],
    [
      "unknown group fields",
      { user: { $select: { posts: { $select: { id: true }, $groupBy: ["nope"] } } } },
      /Unknown group field/,
    ],
    [
      "the reserved items name",
      {
        user: {
          $select: {
            posts: { $select: { id: true }, $groupBy: [{ field: "score", as: "items" }] },
          },
        },
      },
      /reserved/,
    ],
  ])("rejects %s", async (_label, query, message) => {
    const { mesh } = meshFor(seed());
    await expect(mesh.execute(JSON.stringify(query))).rejects.toThrow(message);
  });
});
