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

function pointReadPlan(entityId: string) {
  const ast = parseQl("{ user { id name tokens { accessToken } } }");
  return buildJoinPlan(
    ast,
    schema,
    createQueryContext({ requestId: "1", method: "GET", entityId }),
  );
}

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

describe("buildSelectSql — point read", () => {
  it("builds select with quoted aliases, joins, and where clause", () => {
    const plan = pointReadPlan("123");
    const { sql, params } = buildSelectSql(plan, schema);

    // Aliases are double-quoted so Postgres preserves the camelCase used by
    // the shaper. `tokens.id` is auto-added by the planner so the shaper can
    // dedupe Cartesian-product rows.
    expect(sql).toBe(
      'SELECT users.id AS "user_id", users.name AS "user_name", tokens.id AS "tokens_id", tokens.access_token AS "tokens_accessToken" FROM users LEFT JOIN tokens AS tokens ON tokens.user_id = users.id WHERE users.id = $1',
    );
    expect(params).toEqual(["123"]);
  });

  it("does not add ORDER BY or LIMIT to point reads", () => {
    const plan = pointReadPlan("123");
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).not.toMatch(/ORDER BY/);
    expect(sql).not.toMatch(/LIMIT/);
  });
});

describe("buildSelectSql — collection reads", () => {
  it("passes the shared collection-control conformance fixture", () => {
    const { sql, params } = buildSelectSql(conformancePlan(), schema);
    expect(sql).toContain(
      "WHERE (users.role = ANY($1) AND users.name IS NOT NULL)",
    );
    expect(sql).toContain(
      "ORDER BY users.created_at DESC NULLS LAST, users.id ASC",
    );
    expect(sql).toContain("LIMIT $2");
    expect(params).toEqual([["admin", "owner"], 3]);
  });

  it("renders a $where filter as a parameterised clause", () => {
    const plan = listPlan({
      where: { field: "role", op: "eq", value: "admin" },
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role = $1");
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
    expect(sql).toContain("WHERE (users.role = $1 AND users.id > $2)");
  });

  it("uses Postgres ANY/ALL for in/nin filters", () => {
    const plan = listPlan({
      where: {
        and: [
          { field: "role", op: "in", value: ["admin", "owner"] },
          { field: "role", op: "nin", value: ["banned"] },
        ],
      },
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("(users.role = ANY($1) AND users.role <> ALL($2))");
    expect(params[0]).toEqual(["admin", "owner"]);
    expect(params[1]).toEqual(["banned"]);
  });

  it("respects config.columns for filter field mapping", () => {
    const plan = listPlan({
      where: { field: "createdAt", op: "gte", value: "2026-01-01" },
    });

    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.created_at >= $1");
  });

  it("renders ORDER BY with multiple keys, directions, NULLS, and an id tiebreaker", () => {
    const plan = listPlan({
      orderBy: [
        { field: "createdAt", direction: "desc" },
        { field: "name", direction: "asc" },
      ],
    });

    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain(
      "ORDER BY users.created_at DESC NULLS LAST, users.name ASC NULLS LAST, users.id ASC NULLS LAST",
    );
  });

  it("defaults ORDER BY to id ASC for collection reads without an explicit ORDER BY", () => {
    const plan = listPlan({ page: { first: 20 } });
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("ORDER BY users.id ASC NULLS LAST");
  });

  it("appends LIMIT with the requested page size plus a sentinel row", () => {
    const plan = listPlan({ page: { first: 20 } });
    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain(`LIMIT $${params.length}`);
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

  it("defaults the page size to DEFAULT_PAGE_FIRST (50) plus the sentinel", () => {
    const plan = listPlan({ orderBy: [{ field: "id", direction: "asc" }] });
    const { params } = buildSelectSql(plan, schema);
    expect(params[params.length - 1]).toBe(51);
  });

  it("decodes a read cursor into a keyset predicate", () => {
    const after = cursorForRow({}, { id: 100 });
    const plan = listPlan({ page: { first: 10, after } });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("(users.id) > ($1)");
    expect(params[0]).toBe(100);
  });

  it("combines filter, cursor, orderBy, and limit in the right shape", () => {
    const node = {
      where: { field: "role", op: "eq" as const, value: "admin" },
      orderBy: [{ field: "createdAt", direction: "desc" as const }],
    };
    const after = cursorForRow(node, { createdAt: "2026-01-01", id: 42 });
    const plan = listPlan({ ...node, page: { first: 25, after } });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role = $1");
    expect(sql).toContain("(users.created_at, users.id) < ($2, $3)");
    expect(sql).toContain(
      "ORDER BY users.created_at DESC NULLS LAST, users.id ASC NULLS LAST LIMIT $4",
    );
    expect(params[0]).toBe("admin");
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
    expect(sql).toContain("WHERE users.id = $1");
    expect(sql).not.toContain("role = ");
    expect(sql).not.toContain("LIMIT");
    expect(sql).not.toMatch(/ORDER BY/);
    expect(params).toEqual(["5"]);
  });
});

describe("buildSelectSql — nested joins", () => {
  const blogSchema: MeshSchema = {
    entities: {
      post: { fields: ["id", "title"], table: "posts" },
      comment: { fields: ["id", "body"], table: "comments" },
      user: { fields: ["id", "name"], table: "users" },
    },
    joins: {
      "post.author": {
        entity: "user",
        on: "users.id = posts.author_id",
        type: "one",
      },
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

  it("uses distinct SQL aliases when the same table joins twice", () => {
    const ast = parseQl(
      "{ post { id author { name } comments { body author { name } } } }",
    );
    const plan = buildJoinPlan(
      ast,
      blogSchema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "1" }),
    );
    const { sql } = buildSelectSql(plan, blogSchema);

    expect(sql).toContain("LEFT JOIN users AS author ON author.id = posts.author_id");
    expect(sql).toContain("LEFT JOIN comments AS comments ON comments.post_id = posts.id");
    expect(sql).toContain(
      "LEFT JOIN users AS comments_author ON comments_author.id = comments.author_id",
    );
    expect(sql).toContain('author.name AS "author_name"');
    expect(sql).toContain('comments_author.name AS "comments_author_name"');
  });
});

describe("cursor helpers", () => {
  it("encodes and decodes round-trip", () => {
    const encoded = encodeCursor({ id: 42 });
    expect(decodeCursor(encoded)).toEqual({ id: 42 });
  });

  it("supports string ids", () => {
    const encoded = encodeCursor({ id: "01HZ7XYZ" });
    expect(decodeCursor(encoded)).toEqual({ id: "01HZ7XYZ" });
  });

  it("produces URL-safe output", () => {
    const encoded = encodeCursor({ id: "abc?def=ghi&jkl" });
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeCursor(encoded)).toEqual({ id: "abc?def=ghi&jkl" });
  });

  it("throws on non-JSON payloads", () => {
    const bogus = Buffer.from("not json", "utf8").toString("base64url");
    expect(() => decodeCursor(bogus)).toThrow("Invalid cursor: not valid JSON");
  });

  it("throws on payloads missing 'id'", () => {
    const bogus = Buffer.from(JSON.stringify({ x: 1 }), "utf8").toString("base64url");
    expect(() => decodeCursor(bogus)).toThrow("Invalid cursor: missing 'id' field");
  });
});
