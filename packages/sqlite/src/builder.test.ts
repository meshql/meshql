import { describe, expect, it } from "vitest";
import {
  buildJoinPlan,
  createQueryContext,
  parseJson,
  parseQl,
  type MeshSchema,
} from "@meshql/core";
import { buildSelectSql, decodeCursor, encodeCursor } from "./builder.js";

const schema: MeshSchema = {
  entities: {
    user: {
      type: {},
      fields: ["id", "name", "createdAt", "role"],
      table: "users",
      columns: { createdAt: "created_at" },
    },
    token: {
      type: {},
      fields: ["accessToken", "expiresAt"],
      table: "tokens",
      columns: {
        accessToken: "access_token",
        expiresAt: "expires_at",
      },
    },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
      table: "tokens",
    },
  },
};

function listPlan(list: Record<string, unknown>) {
  const ast = parseJson(
    JSON.stringify({
      user: { id: true, name: true },
      $list: list,
    }),
  );
  return buildJoinPlan(
    ast,
    schema,
    createQueryContext({ requestId: "1", method: "GET" }),
    { list: ast.list },
  );
}

describe("buildSelectSql (SQLite) — point read", () => {
  it("builds a SELECT with `?` placeholders and quoted aliases", () => {
    const ast = parseQl("{ user { id name tokens { accessToken } } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({
        requestId: "1",
        method: "GET",
        entityId: "123",
      }),
    );

    const { sql, params } = buildSelectSql(plan, schema);

    // Same select-list shape as `@meshql/postgres` (double-quoted camelCase
    // aliases, planner-injected `tokens.id` for the shaper) — the only
    // wire-format difference is the `?` placeholder in the WHERE clause.
    expect(sql).toBe(
      'SELECT users.id AS "user_id", users.name AS "user_name", tokens.access_token AS "tokens_accessToken", tokens.id AS "tokens_id" FROM users LEFT JOIN tokens AS tokens ON tokens.user_id = users.id WHERE users.id = ?',
    );
    expect(params).toEqual(["123"]);
  });

  it("omits the WHERE clause and emits no params when no entity id is set", () => {
    const ast = parseQl("{ user { id name } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    const { sql, params } = buildSelectSql(plan, schema);

    expect(sql).toBe(
      'SELECT users.id AS "user_id", users.name AS "user_name" FROM users',
    );
    expect(params).toEqual([]);
  });

  it("does not add ORDER BY or LIMIT to point reads", () => {
    const ast = parseQl("{ user { id name } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "5" }),
    );
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).not.toMatch(/ORDER BY/);
    expect(sql).not.toMatch(/LIMIT/);
  });
});

describe("buildSelectSql (SQLite) — list options", () => {
  it("renders filters as parameterised AND clauses with `?`", () => {
    const plan = listPlan({
      filter: [
        { field: "role", op: "eq", value: "admin" },
        { field: "id", op: "gt", value: 100 },
      ],
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role = ? AND users.id > ?");
    expect(params).toEqual(["admin", 100, 50]); // limit=50 default appended last
  });

  it("expands `in` into IN (?, ?, ?) with positional params", () => {
    const plan = listPlan({
      filter: [{ field: "role", op: "in", value: ["admin", "owner", "auditor"] }],
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role IN (?, ?, ?)");
    // 3 IN values + 1 limit
    expect(params.slice(0, 3)).toEqual(["admin", "owner", "auditor"]);
    expect(params[3]).toBe(50);
  });

  it("expands `nin` into NOT IN (?, ?)", () => {
    const plan = listPlan({
      filter: [{ field: "role", op: "nin", value: ["banned", "spam"] }],
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role NOT IN (?, ?)");
    expect(params.slice(0, 2)).toEqual(["banned", "spam"]);
  });

  it("renders `ilike` as SQLite `LIKE` (case-insensitive for ASCII)", () => {
    const plan = listPlan({
      filter: [{ field: "name", op: "ilike", value: "a%" }],
    });
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.name LIKE ?");
  });

  it("emits `0 = 1` for empty `in` arrays (SQLite has no empty-list syntax)", () => {
    const plan = listPlan({
      filter: [{ field: "role", op: "in", value: [] }],
    });
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE 0 = 1");
  });

  it("emits `1 = 1` for empty `nin` arrays", () => {
    const plan = listPlan({
      filter: [{ field: "role", op: "nin", value: [] }],
    });
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE 1 = 1");
  });

  it("respects config.columns for filter field mapping", () => {
    const plan = listPlan({
      filter: [{ field: "createdAt", op: "gte", value: "2026-01-01" }],
    });

    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.created_at >= ?");
  });

  it("renders multi-key ORDER BY with mixed directions", () => {
    const plan = listPlan({
      orderBy: [
        { field: "createdAt", dir: "desc" },
        { field: "name", dir: "asc" },
      ],
    });

    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("ORDER BY users.created_at DESC, users.name ASC");
  });

  it("defaults ORDER BY to id ASC when list has no explicit ORDER BY", () => {
    const plan = listPlan({ limit: 20 });
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("ORDER BY users.id ASC");
  });

  it("appends LIMIT with the requested value", () => {
    const plan = listPlan({ limit: 20 });
    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql.trimEnd().endsWith("LIMIT ?")).toBe(true);
    expect(params[params.length - 1]).toBe(20);
  });

  it("caps LIMIT at MAX_LIST_LIMIT (200)", () => {
    const ast = parseQl("{ user { id name } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
      { list: { limit: 999 } },
    );
    const { params } = buildSelectSql(plan, schema);
    expect(params[params.length - 1]).toBe(200);
  });

  it("decodes cursor into a WHERE id > ? keyset predicate", () => {
    const cursor = encodeCursor({ id: 100 });
    const plan = listPlan({ cursor });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.id > ?");
    expect(params[0]).toBe(100);
  });

  it("combines filter + cursor + orderBy + limit in the right shape", () => {
    const cursor = encodeCursor({ id: 42 });
    const plan = listPlan({
      filter: [{ field: "role", op: "in", value: ["admin", "owner"] }],
      orderBy: [{ field: "createdAt", dir: "desc" }],
      cursor,
      limit: 25,
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain(
      "WHERE users.role IN (?, ?) AND users.id > ? ORDER BY users.created_at DESC LIMIT ?",
    );
    expect(params).toEqual(["admin", "owner", 42, 25]);
  });

  it("ignores list filters when a point-read entityId is present", () => {
    const ast = parseJson(
      JSON.stringify({
        user: { id: true },
        $list: { filter: [{ field: "role", op: "eq", value: "admin" }] },
      }),
    );
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "5" }),
      { list: ast.list },
    );

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.id = ?");
    expect(sql).not.toContain("role = ");
    expect(sql).not.toContain("LIMIT");
    expect(params).toEqual(["5"]);
  });
});

describe("cursor helpers (SQLite)", () => {
  it("encodes and decodes round-trip", () => {
    expect(decodeCursor(encodeCursor({ id: 42 }))).toEqual({ id: 42 });
  });

  it("wire-compatible with Postgres cursors", () => {
    // Encoded on Postgres side, decoded here — same algorithm.
    const fromPostgres = Buffer.from(JSON.stringify({ id: 99 }), "utf8").toString(
      "base64url",
    );
    expect(decodeCursor(fromPostgres)).toEqual({ id: 99 });
  });

  it("throws on payloads missing 'id'", () => {
    const bogus = Buffer.from(JSON.stringify({ x: 1 }), "utf8").toString("base64url");
    expect(() => decodeCursor(bogus)).toThrow("Invalid cursor: missing 'id' field");
  });
});
