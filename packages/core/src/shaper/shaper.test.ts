import { describe, expect, it } from "vitest";
import { parseQl } from "../parser/index.js";
import { shape, shapeMany } from "./shaper.js";
import type { ResolvedJoin } from "../planner/join-plan.js";

function tokensJoin(overrides: Partial<ResolvedJoin> = {}): ResolvedJoin {
  return {
    path: "tokens",
    joinKey: "user.tokens",
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
    path: "roles",
    joinKey: "user.roles",
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
    path: "author",
    joinKey: "post.author",
    entity: "user",
    on: "users.id = posts.author_id",
    fields: ["author.name"],
    type: "one",
    refName: "author",
    idField: "id",
    ...overrides,
  };
}

function commentsJoin(overrides: Partial<ResolvedJoin> = {}): ResolvedJoin {
  return {
    path: "comments",
    joinKey: "post.comments",
    entity: "comment",
    on: "comments.post_id = posts.id",
    fields: ["comments.body"],
    type: "many",
    refName: "comments",
    idField: "id",
    ...overrides,
  };
}

function commentAuthorJoin(overrides: Partial<ResolvedJoin> = {}): ResolvedJoin {
  return {
    path: "comments.author",
    joinKey: "comments.author",
    entity: "user",
    on: "users.id = comments.author_id",
    fields: ["comments.author.name"],
    type: "one",
    refName: "author",
    idField: "id",
    ...overrides,
  };
}

function tagsJoin(overrides: Partial<ResolvedJoin> = {}): ResolvedJoin {
  return {
    path: "tags",
    joinKey: "post.tags",
    entity: "tag",
    on: "tags.post_id = posts.id",
    fields: ["tags.name"],
    type: "many",
    refName: "tags",
    idField: "id",
    ...overrides,
  };
}

function repliesJoin(overrides: Partial<ResolvedJoin> = {}): ResolvedJoin {
  return {
    path: "comments.replies",
    joinKey: "comment.replies",
    entity: "reply",
    on: "replies.comment_id = comments.id",
    fields: ["comments.replies.body"],
    type: "many",
    refName: "replies",
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

  it("nests grandchildren under a many join (post → comments → author)", () => {
    const ast = parseQl("{ post { id comments { id body author { name } } } }");
    const rows = [
      {
        post_id: 1,
        comments_id: 10,
        comments_body: "hello",
        comments_author_name: "Ada",
      },
      {
        post_id: 1,
        comments_id: 11,
        comments_body: "world",
        comments_author_name: "Grace",
      },
    ];

    const result = shape(rows, ast.root, [
      commentsJoin({ fields: ["comments.id", "comments.body"] }),
      commentAuthorJoin({ fields: ["comments.author.name"] }),
    ]);

    expect(result).toEqual({
      id: 1,
      comments: [
        { id: 10, body: "hello", author: { name: "Ada" } },
        { id: 11, body: "world", author: { name: "Grace" } },
      ],
    });
  });

  it("returns null author when a nested one-join has no match", () => {
    const ast = parseQl("{ post { id comments { id author { name } } } }");
    const rows = [
      {
        post_id: 1,
        comments_id: 10,
        comments_author_id: null,
        comments_author_name: null,
      },
    ];

    const result = shape(rows, ast.root, [
      commentsJoin({ fields: ["comments.id"] }),
      commentAuthorJoin({ fields: ["comments.author.id", "comments.author.name"] }),
    ]);

    expect(result).toEqual({
      id: 1,
      comments: [{ id: 10, author: null }],
    });
  });

  it("disambiguates post.author vs comments.author when both are users", () => {
    const ast = parseQl(
      "{ post { id author { name } comments { body author { name } } } }",
    );
    const rows = [
      {
        post_id: 1,
        author_name: "Post Author",
        comments_id: 10,
        comments_body: "hi",
        comments_author_name: "Comment Author",
      },
    ];

    const result = shape(rows, ast.root, [
      authorJoin({ fields: ["author.name"] }),
      commentsJoin({ fields: ["comments.id", "comments.body"] }),
      commentAuthorJoin({ fields: ["comments.author.name"] }),
    ]);

    expect(result).toEqual({
      id: 1,
      author: { name: "Post Author" },
      comments: [{ body: "hi", author: { name: "Comment Author" } }],
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

// ---------------------------------------------------------------------------
// Regression pins for the O(N²) shapeRefMany rewrite.
//
// These fixtures cover behaviour the refactor MUST preserve. If any of them
// break after the rewrite, either the rewrite has a correctness bug or one of
// these pins encoded an accidental behaviour we now want to change on
// purpose — in that case, the changeset must call it out explicitly.
// ---------------------------------------------------------------------------

describe("shaper \u2014 regression pins for O(N\u00b2) rewrite", () => {
  describe("shape (single record)", () => {
    it("returns {} for empty rows", () => {
      const ast = parseQl("{ user { id name } }");
      expect(shape([], ast.root)).toEqual({});
    });

    it("shapes a point read with no joins", () => {
      const ast = parseQl("{ user { id name email } }");
      const result = shape(
        [{ user_id: 1, user_name: "Ada", user_email: "ada@example.com" }],
        ast.root,
      );
      expect(result).toEqual({
        id: 1,
        name: "Ada",
        email: "ada@example.com",
      });
    });

    it("preserves null field values on the root record", () => {
      const ast = parseQl("{ user { id name bio } }");
      const result = shape(
        [{ user_id: 1, user_name: "Ada", user_bio: null }],
        ast.root,
      );
      expect(result).toEqual({ id: 1, name: "Ada", bio: null });
    });

    it("dedupes two independent many-joins in a single parent (5 comments \u00d7 3 tags = 15 rows)", () => {
      // The Cartesian fanout of two independent many-joins in one parent —
      // the exact shape shapeRefMany must handle without duplication or loss.
      const ast = parseQl(
        "{ post { id title comments { id body } tags { id name } } }",
      );
      const rows: Record<string, unknown>[] = [];
      for (let c = 1; c <= 5; c++) {
        for (let t = 1; t <= 3; t++) {
          rows.push({
            post_id: 1,
            post_title: "Hello",
            comments_id: c,
            comments_body: `comment ${c}`,
            tags_id: t,
            tags_name: `tag-${t}`,
          });
        }
      }

      const result = shape(rows, ast.root, [
        commentsJoin({ fields: ["comments.id", "comments.body"] }),
        tagsJoin({ fields: ["tags.id", "tags.name"] }),
      ]);

      expect(result).toEqual({
        id: 1,
        title: "Hello",
        comments: [1, 2, 3, 4, 5].map((c) => ({
          id: c,
          body: `comment ${c}`,
        })),
        tags: [1, 2, 3].map((t) => ({ id: t, name: `tag-${t}` })),
      });
    });

    it("dedupes nested many-in-many (3 comments \u00d7 2 replies = 6 rows)", () => {
      // Nested many-in-many. Row keys use the path-aliased form
      // `comments_replies_id`, so this also pins parentJoinPath propagation
      // through the shape recursion.
      const ast = parseQl("{ post { id comments { id body replies { id body } } } }");
      const rows: Record<string, unknown>[] = [];
      for (let c = 1; c <= 3; c++) {
        for (let r = 1; r <= 2; r++) {
          rows.push({
            post_id: 1,
            comments_id: c,
            comments_body: `c${c}`,
            comments_replies_id: c * 10 + r,
            comments_replies_body: `c${c}-r${r}`,
          });
        }
      }

      const result = shape(rows, ast.root, [
        commentsJoin({ fields: ["comments.id", "comments.body"] }),
        repliesJoin({
          fields: ["comments.replies.id", "comments.replies.body"],
        }),
      ]);

      expect(result).toEqual({
        id: 1,
        comments: [1, 2, 3].map((c) => ({
          id: c,
          body: `c${c}`,
          replies: [1, 2].map((r) => ({
            id: c * 10 + r,
            body: `c${c}-r${r}`,
          })),
        })),
      });
    });
  });

  describe("shapeMany (list)", () => {
    it("returns [] for empty rows", () => {
      const ast = parseQl("{ user { id name } }");
      expect(shapeMany([], ast.root, [], "id")).toEqual([]);
    });

    it("groups fields-only rows with no joins", () => {
      const ast = parseQl("{ user { id name } }");
      const rows = [
        { user_id: 1, user_name: "Ada" },
        { user_id: 2, user_name: "Grace" },
      ];
      const result = shapeMany(rows, ast.root, [], "id");
      expect(result).toEqual([
        { id: 1, name: "Ada" },
        { id: 2, name: "Grace" },
      ]);
    });

    it("handles multi-parent multi-join fanout (3 posts \u00d7 3 comments \u00d7 2 tags = 18 rows)", () => {
      // Each post has its own Cartesian fanout — verifies that shapeMany's
      // per-group shaping doesn't leak rows across parents.
      const ast = parseQl("{ post { id comments { id body } tags { id name } } }");
      const rows: Record<string, unknown>[] = [];
      for (let p = 1; p <= 3; p++) {
        for (let c = 1; c <= 3; c++) {
          for (let t = 1; t <= 2; t++) {
            rows.push({
              post_id: p,
              comments_id: p * 10 + c,
              comments_body: `p${p}-c${c}`,
              tags_id: p * 10 + t,
              tags_name: `p${p}-t${t}`,
            });
          }
        }
      }

      const result = shapeMany(
        rows,
        ast.root,
        [
          commentsJoin({ fields: ["comments.id", "comments.body"] }),
          tagsJoin({ fields: ["tags.id", "tags.name"] }),
        ],
        "id",
      );

      expect(result).toEqual(
        [1, 2, 3].map((p) => ({
          id: p,
          comments: [1, 2, 3].map((c) => ({
            id: p * 10 + c,
            body: `p${p}-c${c}`,
          })),
          tags: [1, 2].map((t) => ({
            id: p * 10 + t,
            name: `p${p}-t${t}`,
          })),
        })),
      );
    });
  });
});
