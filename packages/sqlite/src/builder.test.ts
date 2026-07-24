import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCursorFromRow,
  buildJoinPlan,
  createQueryContext,
  normalizeReadTree,
  parseJsonQuery,
  parseQl,
  type MeshSchema,
  type ReadNodeWire,
} from "@meshql/core";
import { buildSelectSql, decodeCursor, encodeCursor } from "./builder.js";

function conformancePlan() {
  const raw = readFileSync(
    new URL(
      "../../../specs/fixtures/queries/collection-controls.json",
      import.meta.url,
    ),
    "utf8",
  );
  const { ast, read } = normalizeReadTree(parseJsonQuery(raw).root, schema);
  return buildJoinPlan(
    ast,
    schema,
    createQueryContext({ requestId: "conformance", method: "GET" }),
    { read },
  );
}

const schema: MeshSchema = {
  entities: {
    user: {
      fields: ["id", "name", "createdAt", "role"],
      table: "users",
      columns: { createdAt: "created_at" },
    },
    token: {
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

/** Build a collection-read plan from a normalized read node. */
function listPlan(node: Partial<Omit<ReadNodeWire, "name" | "select">>) {
  const { ast, read } = normalizeReadTree(
    { name: "user", select: { id: true, name: true }, ...node },
    schema,
  );
  return buildJoinPlan(
    ast,
    schema,
    createQueryContext({ requestId: "1", method: "GET" }),
    { read },
  );
}

/** Encode a keyset cursor matching a read for the given row. */
function cursorForRow(
  node: Partial<Omit<ReadNodeWire, "name" | "select">>,
  row: Record<string, unknown>,
): string {
  const { read } = normalizeReadTree(
    { name: "user", select: { id: true, name: true }, ...node },
    schema,
  );
  return buildCursorFromRow(read, row)!;
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
      'SELECT users.id AS "user_id", users.name AS "user_name", tokens.id AS "tokens_id", tokens.access_token AS "tokens_accessToken" FROM users LEFT JOIN tokens AS tokens ON tokens.user_id = users.id WHERE users.id = ?',
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

  it("emits two-hop LEFT JOINs for many-to-many through joins", () => {
    const m2mSchema: MeshSchema = {
      entities: {
        post: { fields: ["id", "title"], table: "posts" },
        tag: { fields: ["id", "name"], table: "tags" },
      },
      joins: {
        "post.tags": {
          entity: "tag",
          on: "post_tags.post_id = posts.id",
          type: "many",
          table: "tags",
          through: { table: "post_tags", from: "post_id", to: "tag_id" },
        },
      },
    };

    const ast = parseQl("{ post { id title tags { name } } }");
    const plan = buildJoinPlan(
      ast,
      m2mSchema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "1" }),
    );
    const { sql, params } = buildSelectSql(plan, m2mSchema);

    expect(sql).toBe(
      'SELECT posts.id AS "post_id", posts.title AS "post_title", tags.id AS "tags_id", tags.name AS "tags_name" FROM posts' +
        ' LEFT JOIN post_tags AS tags__junc ON tags__junc."post_id" = posts.id' +
        ' LEFT JOIN tags AS tags ON tags.id = tags__junc."tag_id"' +
        " WHERE posts.id = ?",
    );
    expect(params).toEqual(["1"]);
  });
});

describe("buildSelectSql (SQLite) — collection reads", () => {
  it("passes the shared collection-control conformance fixture", () => {
    const { sql, params } = buildSelectSql(conformancePlan(), schema);
    expect(sql).toContain(
      "WHERE (users.role IN (?, ?) AND users.name IS NOT NULL)",
    );
    expect(sql).toContain("ORDER BY users.created_at DESC, users.id ASC");
    expect(sql).toContain("LIMIT ?");
    expect(params).toEqual(["admin", "owner", 3]);
  });

  it("renders a $where filter as a parameterised clause with `?`", () => {
    const plan = listPlan({
      where: { field: "role", op: "eq", value: "admin" },
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role = ?");
    // where value + sentinel limit (default 50 + 1)
    expect(params).toEqual(["admin", 51]);
  });

  it("renders boolean AND with parentheses", () => {
    const plan = listPlan({
      where: {
        and: [
          { field: "role", op: "eq", value: "admin" },
          { field: "id", op: "gt", value: 100 },
        ],
      },
    });

    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE (users.role = ? AND users.id > ?)");
  });

  it("expands `in` into IN (?, ?, ?) with positional params", () => {
    const plan = listPlan({
      where: { field: "role", op: "in", value: ["admin", "owner", "auditor"] },
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role IN (?, ?, ?)");
    expect(params.slice(0, 3)).toEqual(["admin", "owner", "auditor"]);
  });

  it("expands `nin` into NOT IN (?, ?)", () => {
    const plan = listPlan({
      where: { field: "role", op: "nin", value: ["banned", "spam"] },
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role NOT IN (?, ?)");
    expect(params.slice(0, 2)).toEqual(["banned", "spam"]);
  });

  it("renders `ilike` as SQLite `LIKE` (case-insensitive for ASCII)", () => {
    const plan = listPlan({
      where: { field: "name", op: "ilike", value: "a%" },
    });
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.name LIKE ?");
  });

  it("respects config.columns for filter field mapping", () => {
    const plan = listPlan({
      where: { field: "createdAt", op: "gte", value: "2026-01-01" },
    });

    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.created_at >= ?");
  });

  it("renders multi-key ORDER BY with mixed directions and an id tiebreaker", () => {
    const plan = listPlan({
      orderBy: [
        { field: "createdAt", direction: "desc" },
        { field: "name", direction: "asc" },
      ],
    });

    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain(
      "ORDER BY users.created_at DESC, users.name ASC, users.id ASC",
    );
  });

  it("defaults ORDER BY to id ASC when no explicit ORDER BY is given", () => {
    const plan = listPlan({ page: { first: 20 } });
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("ORDER BY users.id ASC");
  });

  it("builds GROUP BY + aggregate SELECT and orders by group keys", () => {
    const { ast, read } = normalizeReadTree(
      {
        name: "user",
        select: { name: true },
        groupBy: ["name"],
        aggregates: { total: { fn: "count", field: "*" } },
      },
      schema,
    );
    expect(read.mode).toBe("aggregate");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
      { read },
    );
    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toBe(
      'SELECT users.name AS "name", COUNT(*) AS "total" FROM users GROUP BY users.name ORDER BY users.name ASC LIMIT ?',
    );
    expect(params).toEqual([51]);
  });

  it("appends LIMIT with the requested page size plus a sentinel row", () => {
    const plan = listPlan({ page: { first: 20 } });
    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql.trimEnd().endsWith("LIMIT ?")).toBe(true);
    expect(params[params.length - 1]).toBe(21);
  });

  it("caps the page size at MAX_PAGE_FIRST (200) before the sentinel", () => {
    const { ast, read } = normalizeReadTree(
      { name: "user", select: { id: true, name: true }, page: { first: 200 } },
      schema,
    );
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
      { read },
    );
    const { params } = buildSelectSql(plan, schema);
    expect(params[params.length - 1]).toBe(201);
  });

  it("decodes a read cursor into a keyset predicate", () => {
    const after = cursorForRow({}, { id: 100 });
    const plan = listPlan({ page: { first: 10, after } });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE (users.id) > (?)");
    expect(params[0]).toBe(100);
  });

  it("combines filter + cursor + orderBy + limit in the right shape", () => {
    const node = {
      where: {
        field: "role",
        op: "in" as const,
        value: ["admin", "owner"],
      },
      orderBy: [{ field: "createdAt", direction: "desc" as const }],
    };
    const after = cursorForRow(node, { createdAt: "2026-01-01", id: 42 });
    const plan = listPlan({ ...node, page: { first: 25, after } });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role IN (?, ?)");
    expect(sql).toContain("(users.created_at, users.id) < (?, ?)");
    expect(sql).toContain(
      "ORDER BY users.created_at DESC, users.id ASC LIMIT ?",
    );
    expect(params[0]).toBe("admin");
    expect(params[1]).toBe("owner");
    expect(params[params.length - 1]).toBe(26);
  });

  it("ignores read controls when a point-read entityId is present", () => {
    const { ast, read } = normalizeReadTree(
      {
        name: "user",
        select: { id: true },
        where: { field: "role", op: "eq", value: "admin" },
      },
      schema,
    );
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "5" }),
      { read },
    );

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.id = ?");
    expect(sql).not.toContain("role = ");
    expect(sql).not.toContain("LIMIT");
    expect(sql).not.toMatch(/ORDER BY/);
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
