import { describe, expect, it } from "vitest";
import { parseQl } from "../parser/index.js";
import { shape, shapeMany } from "./shaper.js";
import type { ResolvedJoin } from "../planner/join-plan.js";

function tokensJoin(overrides: Partial<ResolvedJoin> = {}): ResolvedJoin {
  return {
    entity: "token",
    on: "tokens.user_id = users.id",
    fields: ["tokens.accessToken"],
    type: "many",
    refName: "tokens",
    idField: "id",
    ...overrides,
  };
}

function rolesJoin(overrides: Partial<ResolvedJoin> = {}): ResolvedJoin {
  return {
    entity: "role",
    on: "roles.user_id = users.id",
    fields: ["roles.name"],
    type: "many",
    refName: "roles",
    idField: "id",
    ...overrides,
  };
}

function authorJoin(overrides: Partial<ResolvedJoin> = {}): ResolvedJoin {
  return {
    entity: "user",
    on: "users.id = posts.author_id",
    fields: ["author.name"],
    type: "one",
    refName: "author",
    idField: "id",
    ...overrides,
  };
}

describe("shape", () => {
  it("nests flat rows for a single root record", () => {
    const ast = parseQl("{ user { id name tokens { accessToken } } }");
    const result = shape(
      [{ user_id: 1, user_name: "Ada", tokens_accessToken: "abc" }],
      ast.root,
      [tokensJoin()],
    );

    expect(result).toEqual({
      id: 1,
      name: "Ada",
      tokens: [{ accessToken: "abc" }],
    });
  });

  it("dedupes many-to-many cartesian product rows by ref idField", () => {
    const ast = parseQl("{ user { id name tokens { id value } roles { id name } } }");

    // 2 tokens × 2 roles = 4 flat rows after the SQL join. The shaper must
    // dedupe each collection by its own idField so the response contains
    // 2 tokens and 2 roles, not 4 duplicates each.
    const rows = [
      {
        user_id: 1,
        user_name: "Ada",
        tokens_id: "T1",
        tokens_value: "v1",
        roles_id: "R1",
        roles_name: "admin",
      },
      {
        user_id: 1,
        user_name: "Ada",
        tokens_id: "T1",
        tokens_value: "v1",
        roles_id: "R2",
        roles_name: "user",
      },
      {
        user_id: 1,
        user_name: "Ada",
        tokens_id: "T2",
        tokens_value: "v2",
        roles_id: "R1",
        roles_name: "admin",
      },
      {
        user_id: 1,
        user_name: "Ada",
        tokens_id: "T2",
        tokens_value: "v2",
        roles_id: "R2",
        roles_name: "user",
      },
    ];

    const result = shape(rows, ast.root, [
      tokensJoin({ fields: ["tokens.id", "tokens.value"] }),
      rolesJoin({ fields: ["roles.id", "roles.name"] }),
    ]);

    expect(result).toEqual({
      id: 1,
      name: "Ada",
      tokens: [
        { id: "T1", value: "v1" },
        { id: "T2", value: "v2" },
      ],
      roles: [
        { id: "R1", name: "admin" },
        { id: "R2", name: "user" },
      ],
    });
  });

  it("returns an empty collection when a left join has no matching rows", () => {
    const ast = parseQl("{ user { id tokens { id accessToken } } }");
    const rows = [
      {
        user_id: 1,
        tokens_id: null,
        tokens_accessToken: null,
      },
    ];

    const result = shape(rows, ast.root, [
      tokensJoin({ fields: ["tokens.id", "tokens.accessToken"] }),
    ]);

    expect(result).toEqual({ id: 1, tokens: [] });
  });

  it("returns null for a one-cardinality join with no matching rows", () => {
    const ast = parseQl("{ post { id author { id name } } }");
    const rows = [
      {
        post_id: 10,
        author_id: null,
        author_name: null,
      },
    ];

    const result = shape(rows, ast.root, [
      authorJoin({ fields: ["author.id", "author.name"] }),
    ]);

    expect(result).toEqual({ id: 10, author: null });
  });

  it("falls back to row-as-unique when the ref id column is absent", () => {
    // Resolver did not return tokens.id, so the shaper cannot dedupe. It
    // should not silently drop rows — instead emit one nested record per
    // input row, preserving pre-0.2 behaviour.
    const ast = parseQl("{ user { id tokens { accessToken } } }");
    const rows = [
      { user_id: 1, tokens_accessToken: "a" },
      { user_id: 1, tokens_accessToken: "b" },
    ];

    const result = shape(rows, ast.root, [tokensJoin()]);

    expect(result).toEqual({
      id: 1,
      tokens: [{ accessToken: "a" }, { accessToken: "b" }],
    });
  });
});

describe("shapeMany", () => {
  it("groups rows by the root idField across multiple records", () => {
    const ast = parseQl("{ user { id name tokens { id accessToken } } }");

    // User 1 has 2 tokens, User 2 has 1 token — 3 rows total after the SQL
    // join, must produce 2 user records with 2 and 1 nested tokens.
    const rows = [
      {
        user_id: 1,
        user_name: "Ada",
        tokens_id: "T1",
        tokens_accessToken: "a1",
      },
      {
        user_id: 1,
        user_name: "Ada",
        tokens_id: "T2",
        tokens_accessToken: "a2",
      },
      {
        user_id: 2,
        user_name: "Grace",
        tokens_id: "T3",
        tokens_accessToken: "g1",
      },
    ];

    const result = shapeMany(
      rows,
      ast.root,
      [tokensJoin({ fields: ["tokens.id", "tokens.accessToken"] })],
      "id",
    );

    expect(result).toEqual([
      {
        id: 1,
        name: "Ada",
        tokens: [
          { id: "T1", accessToken: "a1" },
          { id: "T2", accessToken: "a2" },
        ],
      },
      {
        id: 2,
        name: "Grace",
        tokens: [{ id: "T3", accessToken: "g1" }],
      },
    ]);
  });

  it("uses a custom rootIdField when provided", () => {
    const ast = parseQl("{ user { name } }");
    const rows = [
      { user_uuid: "u-1", user_name: "Ada" },
      { user_uuid: "u-2", user_name: "Grace" },
    ];

    const result = shapeMany(rows, ast.root, [], "uuid");

    expect(result).toEqual([{ name: "Ada" }, { name: "Grace" }]);
  });

  it("falls back to row-per-record when the root id column is absent", () => {
    const ast = parseQl("{ user { name } }");
    const rows = [{ user_name: "Ada" }, { user_name: "Grace" }];

    const result = shapeMany(rows, ast.root, [], "id");

    expect(result).toEqual([{ name: "Ada" }, { name: "Grace" }]);
  });
});
