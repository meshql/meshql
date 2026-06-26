/**
 * Integration tests for `buildSelectSql` against a real Postgres server.
 *
 * These tests are the regression guard for two Phase 1 fixes that unit tests
 * cannot observe with in-memory fixtures:
 *
 * 1. **camelCase aliases survive Postgres** — without double-quoted aliases,
 *    Postgres folds `tokens_accessToken` to `tokens_accesstoken` and the
 *    shaper silently returns `undefined` for the field.
 * 2. **Shaper deduplication on multi-many Cartesian rows** — when a row has
 *    two `many` joins, the SQL result is the cross-product of their children
 *    and the shaper must dedupe by each join's `idField`.
 * 3. **Left-join no-match returns `[]` (many) / `null` (one)** — a parent with
 *    no children should not produce `[{}]` placeholder records.
 *
 * Skipped when `DATABASE_URL` is unset so local `pnpm test` stays hermetic.
 * Use `pnpm test:integration` after starting a Postgres container — see
 * `.github/workflows/ci.yml` for the canonical configuration.
 *
 * Naming note: ref names use simple `+s` pluralization (`tokens`, `notes`) to
 * match the planner/validator's current `replace(/s$/, "")` singularization.
 * Entities that pluralize as `+es` (e.g. `addresses`) hit a pre-existing
 * planner bug tracked separately.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createMesh, type MeshSchema } from "@meshql/core";
import { buildSelectSql } from "./builder.js";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

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

describeIfDb("buildSelectSql against real Postgres", () => {
  const pool = new Pool({ connectionString: DATABASE_URL });

  beforeAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS notes, tokens, users CASCADE`);
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        access_token TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        body TEXT NOT NULL
      );
    `);

    await pool.query(`INSERT INTO users (id, name) VALUES (1, 'Ada'), (2, 'Grace')`);
    await pool.query(`SELECT setval('users_id_seq', 2)`);

    await pool.query(`
      INSERT INTO tokens (user_id, access_token, expires_at) VALUES
        (1, 'tok_ada_1', '2026-12-31'),
        (1, 'tok_ada_2', '2027-01-15'),
        (2, 'tok_grace_1', '2026-06-30')
    `);

    await pool.query(`
      INSERT INTO notes (user_id, body) VALUES
        (1, 'first analytical engine draft'),
        (1, 'second pass on the engine'),
        (1, 'note to self: poetry vs programs')
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("round-trips camelCase aliases through real Postgres", async () => {
    const mesh = createMesh(schema);
    mesh.resolve("user", async (plan) => {
      const { sql, params } = buildSelectSql(plan, schema);
      const result = await pool.query(sql, params);
      return result.rows;
    });

    const response = await mesh.execute(
      "{ user { id name tokens { accessToken expiresAt } } }",
      { context: { requestId: "1", method: "GET", entityId: "1" } },
    );

    expect(response).toEqual({
      id: 1,
      name: "Ada",
      tokens: [
        { accessToken: "tok_ada_1", expiresAt: "2026-12-31" },
        { accessToken: "tok_ada_2", expiresAt: "2027-01-15" },
      ],
    });
  });

  it("dedupes multi-many Cartesian rows by each join's idField", async () => {
    // Ada has 2 tokens × 3 notes = 6 flat rows. Without per-join dedup
    // the response would duplicate each token thrice and each note twice.
    const mesh = createMesh(schema);
    mesh.resolve("user", async (plan) => {
      const { sql, params } = buildSelectSql(plan, schema);
      const result = await pool.query(sql, params);
      return result.rows;
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
    // Grace has 1 token and 0 notes. The left-join produces one row with
    // null note columns; the shaper must emit `notes: []`, not `[{}]`.
    const mesh = createMesh(schema);
    mesh.resolve("user", async (plan) => {
      const { sql, params } = buildSelectSql(plan, schema);
      const result = await pool.query(sql, params);
      return result.rows;
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
