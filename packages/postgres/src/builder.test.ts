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

function pointReadPlan(entityId: string) {
  const ast = parseQl("{ user { id name tokens { accessToken } } }");
  return buildJoinPlan(
    ast,
    schema,
    createQueryContext({ requestId: "1", method: "GET", entityId }),
  );
}

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

describe("buildSelectSql — point read", () => {
  it("builds select with quoted aliases, joins, and where clause", () => {
    const plan = pointReadPlan("123");
    const { sql, params } = buildSelectSql(plan, schema);

    // Aliases are double-quoted so Postgres preserves the camelCase used by
    // the shaper. `tokens.id` is auto-added by the planner so the shaper can
    // dedupe Cartesian-product rows.
    expect(sql).toBe(
      'SELECT users.id AS "user_id", users.name AS "user_name", tokens.access_token AS "tokens_accessToken", tokens.id AS "tokens_id" FROM users LEFT JOIN tokens AS tokens ON tokens.user_id = users.id WHERE users.id = $1',
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

describe("buildSelectSql — list options", () => {
  it("renders filters as parameterised AND clauses", () => {
    const plan = listPlan({
      filter: [
        { field: "role", op: "eq", value: "admin" },
        { field: "id", op: "gt", value: 100 },
      ],
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role = $1 AND users.id > $2");
    expect(params).toEqual(["admin", 100, 50]); // limit=50 default appended last
  });

  it("uses Postgres ANY/ALL for in/nin filters", () => {
    const plan = listPlan({
      filter: [
        { field: "role", op: "in", value: ["admin", "owner"] },
        { field: "role", op: "nin", value: ["banned"] },
      ],
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.role = ANY($1) AND users.role <> ALL($2)");
    expect(params[0]).toEqual(["admin", "owner"]);
    expect(params[1]).toEqual(["banned"]);
  });

  it("respects config.columns for filter field mapping", () => {
    const plan = listPlan({
      filter: [{ field: "createdAt", op: "gte", value: "2026-01-01" }],
    });

    const { sql } = buildSelectSql(plan, schema);
    // 'createdAt' remaps to 'created_at'.
    expect(sql).toContain("WHERE users.created_at >= $1");
  });

  it("renders ORDER BY with multiple keys and mixed directions", () => {
    const plan = listPlan({
      orderBy: [
        { field: "createdAt", dir: "desc" },
        { field: "name", dir: "asc" },
      ],
    });

    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("ORDER BY users.created_at DESC, users.name ASC");
  });

  it("defaults ORDER BY to id ASC for list reads without an explicit ORDER BY", () => {
    const plan = listPlan({ limit: 20 });
    const { sql } = buildSelectSql(plan, schema);
    expect(sql).toContain("ORDER BY users.id ASC");
  });

  it("appends LIMIT with the requested value", () => {
    const plan = listPlan({ limit: 20 });
    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain(`LIMIT $${params.length}`);
    expect(params[params.length - 1]).toBe(20);
  });

  it("caps LIMIT at MAX_LIST_LIMIT (200) even if plan.list.limit is higher", () => {
    // Bypass validator by constructing the plan manually so the builder's
    // defensive cap is what we're testing.
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

  it("defaults LIMIT to DEFAULT_LIST_LIMIT (50) when plan.list is set with no limit", () => {
    const plan = listPlan({ orderBy: [{ field: "id", dir: "asc" }] });
    const { params } = buildSelectSql(plan, schema);
    expect(params[params.length - 1]).toBe(50);
  });

  it("decodes cursor into a WHERE id > $n keyset predicate", () => {
    const cursor = encodeCursor({ id: 100 });
    const plan = listPlan({ cursor });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toMatch(/WHERE users\.id > \$1/);
    expect(params[0]).toBe(100);
  });

  it("combines filter, cursor, orderBy, and limit in the right shape", () => {
    const cursor = encodeCursor({ id: 42 });
    const plan = listPlan({
      filter: [{ field: "role", op: "eq", value: "admin" }],
      orderBy: [{ field: "createdAt", dir: "desc" }],
      cursor,
      limit: 25,
    });

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain(
      "WHERE users.role = $1 AND users.id > $2 ORDER BY users.created_at DESC LIMIT $3",
    );
    expect(params).toEqual(["admin", 42, 25]);
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
      createQueryContext({
        requestId: "1",
        method: "GET",
        entityId: "5",
      }),
      { list: ast.list },
    );

    const { sql, params } = buildSelectSql(plan, schema);
    expect(sql).toContain("WHERE users.id = $1");
    expect(sql).not.toContain("role = ");
    expect(sql).not.toContain("LIMIT");
    expect(params).toEqual(["5"]);
  });
});

describe("buildSelectSql — nested joins", () => {
  const blogSchema: MeshSchema = {
    entities: {
      post: { type: {}, fields: ["id", "title"], table: "posts" },
      comment: { type: {}, fields: ["id", "body"], table: "comments" },
      user: { type: {}, fields: ["id", "name"], table: "users" },
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
