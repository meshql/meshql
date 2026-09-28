/**
 * Integration tests for the nested fetch strategy (per-parent relation
 * controls and bucketed `$groupBy`) against a real Postgres server.
 *
 * Uses its own `nested_e2e` schema so it can run alongside
 * `builder.integration.test.ts`. Skipped when `DATABASE_URL` is unset.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import {
  createMesh,
  type CollectionResult,
  type JoinPlan,
  type MeshSchema,
} from "@meshql/core";
import { buildSelectSql } from "./builder.js";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

type Row = Record<string, unknown>;

const schema: MeshSchema = {
  entities: {
    user: { fields: ["id", "name"], table: "users" },
    post: {
      fields: ["id", "title", "score", "userId"],
      table: "posts",
      columns: { userId: "user_id" },
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

describeIfDb("nested fetch strategy against real Postgres", () => {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    options: "-c search_path=nested_e2e -c TimeZone=UTC",
  });

  beforeAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS nested_e2e CASCADE`);
    await pool.query(`CREATE SCHEMA nested_e2e`);
    await pool.query(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL,
        title TEXT NOT NULL, score INTEGER NOT NULL
      );
      CREATE TABLE comments (
        id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, author_id INTEGER NOT NULL,
        body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE tags (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
      CREATE TABLE post_tags (post_id INTEGER NOT NULL, tag_id INTEGER NOT NULL);

      INSERT INTO users VALUES (1, 'Ada'), (2, 'Grace'), (3, 'Linus');
      INSERT INTO tags VALUES (1, 'math'), (2, 'engines');
      INSERT INTO posts SELECT i, 1, 'ada post ' || i, i * 10 FROM generate_series(1, 7) AS i;
      INSERT INTO posts VALUES (8, 2, 'grace post 8', 5), (9, 2, 'grace post 9', 50);
      INSERT INTO comments
        SELECT n, 7, (n % 2) + 1, 'c' || n,
               timestamptz '2026-09-26 10:00:00+00'
                 + ((n - 1) / 4) * interval '1 day'
                 + ((n - 1) % 4) * interval '1 hour'
        FROM generate_series(1, 12) AS n;
      INSERT INTO comments VALUES (13, 9, 1, 'on grace', '2026-09-20 08:00:00+00');
      INSERT INTO post_tags VALUES (7, 1), (7, 2), (6, 2);
    `);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS nested_e2e CASCADE`);
    await pool.end();
  });

  function meshWithPool() {
    const mesh = createMesh(schema);
    const plans: JoinPlan[] = [];
    const resolver = async (plan: JoinPlan) => {
      plans.push(plan);
      const { sql, params } = buildSelectSql(plan, schema);
      return (await pool.query(sql, params)).rows;
    };
    mesh.resolve("user", resolver);
    mesh.resolve("post", resolver);
    mesh.resolve("comment", resolver);
    return { mesh, plans };
  }

  it("returns users, their top 5 posts, and the last 10 comments bucketed by day", async () => {
    const { mesh, plans } = meshWithPool();
    const query = {
      user: {
        $select: {
          id: true,
          name: true,
          posts: {
            $select: {
              id: true,
              score: true,
              tags: { $select: { label: true } },
              comments: {
                $select: { id: true, author: { $select: { name: true } } },
                $orderBy: [{ field: "createdAt", direction: "desc" }],
                $page: { first: 10 },
                $groupBy: [{ field: "createdAt", bucket: "day", as: "date" }],
                $aggregate: { count: { fn: "count", field: "*" } },
              },
            },
            $orderBy: [{ field: "score", direction: "desc" }],
            $page: { first: 5 },
          },
        },
        $page: { first: 2 },
      },
    };
    const result = (await mesh.execute(JSON.stringify(query))) as CollectionResult<Row>;

    expect(plans[0]!.strategy).toBe("nested");
    expect(result.items.map((user) => user.name)).toEqual(["Ada", "Grace"]);
    expect(result.pageInfo.hasNextPage).toBe(true);

    const adaPosts = result.items[0]!.posts as Row[];
    expect(adaPosts.map((post) => post.score)).toEqual([70, 60, 50, 40, 30]);
    expect(adaPosts[0]!.tags).toEqual([{ label: "math" }, { label: "engines" }]);

    const buckets = adaPosts[0]!.comments as Row[];
    expect(buckets.map((bucket) => [bucket.date, bucket.count])).toEqual([
      ["2026-09-28", 4],
      ["2026-09-27", 4],
      ["2026-09-26", 2],
    ]);
    expect(buckets[2]!.items).toEqual([
      { id: 4, author: { name: "Ada" } },
      { id: 3, author: { name: "Grace" } },
    ]);
  });

  it("applies nested $where per parent", async () => {
    const { mesh } = meshWithPool();
    const query = {
      user: {
        $select: {
          name: true,
          posts: { $select: { id: true }, $where: { field: "score", op: "in", value: [50, 60] } },
        },
        $where: { field: "id", op: "lte", value: 2 },
      },
    };
    const result = (await mesh.execute(JSON.stringify(query))) as CollectionResult<Row>;
    expect(result.items).toEqual([
      { name: "Ada", posts: [{ id: 5 }, { id: 6 }] },
      { name: "Grace", posts: [{ id: 9 }] },
    ]);
  });

  it("buckets root aggregates by week", async () => {
    const { mesh } = meshWithPool();
    const query = {
      comment: {
        $select: { id: true },
        $groupBy: [{ field: "createdAt", bucket: "week", as: "week" }],
        $aggregate: { total: { fn: "count", field: "*" } },
      },
    };
    const result = (await mesh.execute(JSON.stringify(query))) as CollectionResult<Row>;
    // 2026-09-20 is a Sunday (week of Mon 09-14); 09-26/27 fall in the
    // week of Mon 09-21; 09-28 is a Monday.
    expect(result.items.map((row) => [row.week, Number(row.total)])).toEqual([
      ["2026-09-14", 1],
      ["2026-09-21", 8],
      ["2026-09-28", 4],
    ]);
  });
});
