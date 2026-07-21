/**
 * End-to-end tests against Node's built-in `node:sqlite` (Node 22.5+).
 *
 * Unlike the Postgres integration suite, these run hermetically as part of
 * the default `pnpm test` — no Docker, no service container, no env vars.
 * They exercise exactly the same Phase 1 regressions:
 *
 *   1. camelCase aliases survive the round trip
 *   2. multi-many Cartesian rows are deduped by each join's `idField`
 *   3. left-join no-match returns `[]` for `many`
 *
 * If `node:sqlite` is unavailable (Node < 22.5), the suite skips itself
 * rather than failing.
 */
import { describe, expect, it } from "vitest";
import {
  createMesh,
  type CollectionResult,
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

/**
 * `node:sqlite` accepts `null | number | bigint | string | Uint8Array` as
 * bound parameter values. Our `SqlQuery.params` is `unknown[]` because the
 * core type doesn't know about driver-specific value types — the cast
 * below is the adapter's responsibility.
 */
type SqliteParam = null | number | bigint | string | Uint8Array;

const schema: MeshSchema = {
  entities: {
    user: { fields: ["id", "name"], table: "users" },
    token: {
      fields: ["accessToken", "expiresAt"],
      table: "tokens",
      columns: {
        accessToken: "access_token",
        expiresAt: "expires_at",
      },
    },
    note: {
      fields: ["body"],
      table: "notes",
    },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
      table: "tokens",
    },
    "user.notes": {
      entity: "note",
      on: "notes.user_id = users.id",
      type: "many",
      table: "notes",
    },
  },
};

function seed() {
  const db = new DatabaseSync!(":memory:");
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      access_token TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL
    );

    INSERT INTO users (id, name) VALUES (1, 'Ada'), (2, 'Grace');
    INSERT INTO tokens (user_id, access_token, expires_at) VALUES
      (1, 'tok_ada_1', '2026-12-31'),
      (1, 'tok_ada_2', '2027-01-15'),
      (2, 'tok_grace_1', '2026-06-30');
    INSERT INTO notes (user_id, body) VALUES
      (1, 'first analytical engine draft'),
      (1, 'second pass on the engine'),
      (1, 'note to self: poetry vs programs');
  `);
  return db;
}

describeIfSqlite("buildSelectSql round-trips against node:sqlite", () => {
  it("round-trips camelCase aliases", () => {
    const db = seed();
    const mesh = createMesh(schema);
    mesh.resolve("user", async (plan) => {
      const { sql, params } = buildSelectSql(plan, schema);
      return db.prepare(sql).all(...(params as SqliteParam[]));
    });

    return mesh
      .execute("{ user { id name tokens { accessToken expiresAt } } }", {
        context: { requestId: "1", method: "GET", entityId: "1" },
      })
      .then((response) => {
        expect(response).toEqual({
          id: 1,
          name: "Ada",
          tokens: [
            { accessToken: "tok_ada_1", expiresAt: "2026-12-31" },
            { accessToken: "tok_ada_2", expiresAt: "2027-01-15" },
          ],
        });
      });
  });

  it("dedupes multi-many Cartesian rows by each join's idField", async () => {
    // Ada has 2 tokens × 3 notes = 6 flat rows. The shaper must emit
    // exactly 2 tokens and 3 notes, not 6 of each.
    const db = seed();
    const mesh = createMesh(schema);
    mesh.resolve("user", async (plan) => {
      const { sql, params } = buildSelectSql(plan, schema);
      return db.prepare(sql).all(...(params as SqliteParam[]));
    });

    const response = (await mesh.execute(
      "{ user { id name tokens { accessToken } notes { body } } }",
      { context: { requestId: "1", method: "GET", entityId: "1" } },
    )) as {
      id: number;
      name: string;
      tokens: { accessToken: string }[];
      notes: { body: string }[];
    };

    expect(response.id).toBe(1);
    expect(response.name).toBe("Ada");
    expect(response.tokens).toHaveLength(2);
    expect(response.tokens.map((t) => t.accessToken).sort()).toEqual([
      "tok_ada_1",
      "tok_ada_2",
    ]);
    expect(response.notes).toHaveLength(3);
    expect(response.notes.map((n) => n.body).sort()).toEqual([
      "first analytical engine draft",
      "note to self: poetry vs programs",
      "second pass on the engine",
    ]);
  });

  it("returns [] for many-join with no matching children", async () => {
    // Grace has 1 token and 0 notes. `notes` must be `[]`, not `[{}]`.
    const db = seed();
    const mesh = createMesh(schema);
    mesh.resolve("user", async (plan) => {
      const { sql, params } = buildSelectSql(plan, schema);
      return db.prepare(sql).all(...(params as SqliteParam[]));
    });

    const response = await mesh.execute(
      "{ user { id name tokens { accessToken } notes { body } } }",
      { context: { requestId: "2", method: "GET", entityId: "2" } },
    );

    expect(response).toEqual({
      id: 2,
      name: "Grace",
      tokens: [{ accessToken: "tok_grace_1" }],
      notes: [],
    });
  });

  it("round-trips three-level nesting (post → comments → author)", async () => {
    const blogSchema: MeshSchema = {
      entities: {
        post: { fields: ["id", "title"], table: "posts" },
        comment: { fields: ["id", "body"], table: "comments" },
        user: { fields: ["id", "name"], table: "users" },
      },
      joins: {
        "post.comments": {
          entity: "comment",
          on: "comments.post_id = posts.id",
          type: "many",
          table: "comments",
        },
        "comments.author": {
          entity: "user",
          on: "users.id = comments.author_id",
          type: "one",
          table: "users",
        },
      },
    };

    const db = new DatabaseSync!(":memory:");
    db.exec(`
      CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE comments (
        id INTEGER PRIMARY KEY,
        body TEXT NOT NULL,
        post_id INTEGER NOT NULL REFERENCES posts(id),
        author_id INTEGER NOT NULL REFERENCES users(id)
      );
      INSERT INTO posts (id, title) VALUES (1, 'Hello');
      INSERT INTO users (id, name) VALUES (1, 'Ada'), (2, 'Grace');
      INSERT INTO comments (id, body, post_id, author_id) VALUES
        (10, 'first', 1, 1),
        (11, 'second', 1, 2);
    `);

    const mesh = createMesh(blogSchema);
    mesh.resolve("post", async (plan) => {
      const { sql, params } = buildSelectSql(plan, blogSchema);
      return db.prepare(sql).all(...(params as SqliteParam[]));
    });

    const response = (await mesh.execute(
      "{ post { id title comments { body author { name } } } }",
      { context: { requestId: "1", method: "GET", entityId: "1" } },
    )) as {
      id: number;
      title: string;
      comments: Array<{ body: string; author: { name: string } }>;
    };

    expect(response).toEqual({
      id: 1,
      title: "Hello",
      comments: [
        { body: "first", author: { name: "Ada" } },
        { body: "second", author: { name: "Grace" } },
      ],
    });
  });

  describe("collection reads against node:sqlite", () => {
    type Db = InstanceType<NonNullable<typeof DatabaseSync>>;
    type UserRow = { id: number; name: string };

    async function runList(
      db: Db,
      controls: Record<string, unknown>,
    ): Promise<CollectionResult<UserRow>> {
      const mesh = createMesh(schema);
      mesh.resolve("user", async (plan) => {
        const { sql, params } = buildSelectSql(plan, schema);
        return db.prepare(sql).all(...(params as SqliteParam[]));
      });
      return (await mesh.execute(
        JSON.stringify({ user: { id: true, name: true, ...controls } }),
        { format: "json" },
      )) as CollectionResult<UserRow>;
    }

    it("respects page size and default id ORDER BY, reporting hasNextPage", async () => {
      const db = seed();
      const result = await runList(db, { $page: { first: 1 } });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ id: 1, name: "Ada" });
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it("applies a $where eq filter via a parameterised clause", async () => {
      const db = seed();
      const result = await runList(db, {
        $where: { field: "name", op: "eq", value: "Grace" },
      });
      expect(result.items).toEqual([{ id: 2, name: "Grace" }]);
    });

    it("applies an `in` filter with expanded placeholders", async () => {
      const db = seed();
      const result = await runList(db, {
        $where: { field: "name", op: "in", value: ["Ada", "Grace"] },
      });
      expect(result.items.map((r) => r.name).sort()).toEqual(["Ada", "Grace"]);
    });

    it("applies `ilike` case-insensitively via SQLite LIKE", async () => {
      const db = seed();
      const result = await runList(db, {
        $where: { field: "name", op: "ilike", value: "a%" },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("Ada");
    });

    it("respects ORDER BY with an explicit direction", async () => {
      const db = seed();
      const result = await runList(db, {
        $orderBy: [{ field: "name", direction: "desc" }],
      });
      expect(result.items.map((r) => r.name)).toEqual(["Grace", "Ada"]);
    });

    it("paginates via a scoped keyset cursor", async () => {
      const db = seed();
      const page1 = await runList(db, { $page: { first: 1 } });
      expect(page1.items).toHaveLength(1);
      const after = page1.pageInfo.endCursor!;
      expect(after).toBeTruthy();

      const page2 = await runList(db, { $page: { first: 1, after } });
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]!.id).toBeGreaterThan(page1.items[0]!.id);
    });

    it("returns $aggregate aliases alongside $groupBy keys", async () => {
      const db = seed();
      const mesh = createMesh(schema);
      mesh.resolve("user", async (plan) => {
        const { sql, params } = buildSelectSql(plan, schema);
        expect(sql).toContain("COUNT(*) AS \"total\"");
        expect(sql).toContain("GROUP BY users.name");
        expect(sql).toContain("ORDER BY users.name ASC");
        return db.prepare(sql).all(...(params as SqliteParam[]));
      });

      const result = (await mesh.execute(
        JSON.stringify({
          user: {
            $select: { name: true },
            $groupBy: ["name"],
            $aggregate: { total: { fn: "count", field: "*" } },
          },
        }),
        { format: "json" },
      )) as CollectionResult<{ name: string; total: number }>;

      expect(result.items).toEqual([
        { name: "Ada", total: 1 },
        { name: "Grace", total: 1 },
      ]);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.startCursor).toBeTruthy();
      expect(result.pageInfo.endCursor).toBeTruthy();
    });
  });
});
