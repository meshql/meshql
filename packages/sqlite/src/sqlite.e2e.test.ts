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
import { createMesh, type MeshSchema } from "@meshql/core";
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
    user: { type: {}, fields: ["id", "name"], table: "users" },
    token: {
      type: {},
      fields: ["accessToken", "expiresAt"],
      table: "tokens",
      columns: {
        accessToken: "access_token",
        expiresAt: "expires_at",
      },
    },
    note: {
      type: {},
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
});
