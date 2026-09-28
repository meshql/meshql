# SQL integration

MeshQL's `buildSelectSql()` (from `@meshql/postgres` or `@meshql/sqlite`) turns a JoinPlan into parameterized SQL.

You supply the database connection — MeshQL does not manage pools or clients. See [Database connections](./database-connections.md).

## Basic usage

```typescript
import { createMesh, type MeshSchema } from "@meshql/core";
import { buildSelectSql } from "@meshql/postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schema: MeshSchema = {
  entities: {
    user: { fields: ["id", "name"], table: "users" },
    token: {
      fields: ["accessToken"],
      table: "tokens",
      columns: { accessToken: "access_token" },
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

const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  const result = await pool.query(sql, params);
  return result.rows;
});
```

## Generated SQL

For a query requesting `user.id`, `user.name`, and `user.tokens.accessToken`, you get something like:

```sql
SELECT
  users.id AS user_id,
  users.name AS user_name,
  tokens.access_token AS tokens_accessToken
FROM users
LEFT JOIN tokens ON tokens.user_id = users.id
WHERE users.id = $1
```

Column aliases match what the shaper expects (`entity_field` or `join_field`). Multi-hop joins (e.g. `post.comments.author.name`) use distinct table aliases per path.

## Per-parent relation controls

A flat `LEFT JOIN` cannot limit, order or group rows *per parent*. When any
`many` relation in a query carries explicit `$where`, `$orderBy`, `$page`,
`$groupBy` or `$aggregate`, the planner sets `plan.strategy = "nested"` and
`buildSelectSql` renders every relation as a correlated subquery that returns
JSON. It is still one SQL statement and one round trip; plain selections keep
the flat plan above.

"Users, their top 5 posts, and each post's last 10 comments grouped by day":

```json
{
  "user": {
    "$select": {
      "id": true,
      "name": true,
      "posts": {
        "$select": {
          "id": true,
          "score": true,
          "comments": {
            "$select": { "id": true, "createdAt": true },
            "$orderBy": [{ "field": "createdAt", "direction": "desc" }],
            "$page": { "first": 10 },
            "$groupBy": [{ "field": "createdAt", "bucket": "day", "as": "date" }],
            "$aggregate": { "count": { "fn": "count", "field": "*" } }
          }
        },
        "$orderBy": [{ "field": "score", "direction": "desc" }],
        "$page": { "first": 5 }
      }
    },
    "$page": { "first": 20 }
  }
}
```

Postgres output (SQLite uses `json_group_array` / `json_object` / `strftime`):

```sql
SELECT users.id AS "id", users.name AS "name",
  (SELECT coalesce(json_agg(json_build_object('id', posts.id, 'score', posts.score,
      'comments', (SELECT coalesce(json_agg(json_build_object('date', posts_comments__g."date",
          'count', posts_comments__g."count", 'items', posts_comments__g."items")
          ORDER BY posts_comments__g."date" DESC), '[]'::json)
        FROM (SELECT to_char(date_trunc('day', posts_comments.created_at), 'YYYY-MM-DD') AS "date",
                     COUNT(*) AS "count",
                     coalesce(json_agg(json_build_object(...) ORDER BY ...), '[]'::json) AS "items"
              FROM (SELECT posts_comments.* FROM comments AS posts_comments
                    WHERE posts_comments.post_id = posts.id
                    ORDER BY posts_comments.created_at DESC ... LIMIT $1) AS posts_comments
              GROUP BY to_char(date_trunc('day', posts_comments.created_at), 'YYYY-MM-DD')
              ORDER BY ...) AS posts_comments__g))
    ORDER BY posts.score DESC ...), '[]'::json)
   FROM (SELECT posts.* FROM posts AS posts WHERE posts.user_id = users.id
         ORDER BY posts.score DESC ... LIMIT $2) AS posts) AS "posts"
FROM users ORDER BY users.id ASC NULLS LAST LIMIT $3
```

Each `comments` value is a list of buckets:

```json
[{ "date": "2026-09-28", "count": 4, "items": [{ "id": 12, "createdAt": "..." }] }]
```

Notes:

- The root `LIMIT` counts root rows, so `$page.first: 20` returns 20 users.
- Nested `$page` supports `first` only; `$page.after` on a nested relation is rejected.
- Buckets (`hour`, `day`, `week`, `month`, `year`) render as ISO-8601 prefixes
  (`2026-09-28`, `2026-09`, …). `week` is the Monday of the ISO week. Postgres
  truncates in the session time zone; SQLite expects ISO-8601 text columns.
- `buildSelectSql` sets `plan.rowFormat = "nested"` so the executor parses the
  JSON columns. A custom resolver that ignores `plan.strategy` and returns flat
  rows keeps working, but per-parent controls are not applied.
- SQLite needs 3.44+ for `ORDER BY` inside `json_group_array`. On older builds
  pass `buildSelectSql(plan, schema, { aggregateOrderBy: false })`.
- Polymorphic relations cannot be combined with per-parent controls yet.

## When to skip buildSelectSql

You don't have to use the SQL builder. Any resolver that returns correctly aliased flat rows works:

```typescript
mesh.resolve("user", async (plan) => {
  if (!plan.fields.includes("name")) {
    // client didn't ask for name — skip that column
  }
  return customDataSource.fetch(plan);
});
```

ORM adapters (Prisma, Drizzle) return pre-shaped nested JSON instead. Kysely uses `buildSelectSql` under the hood. See [ORM adapters](./orm-adapters.md).

## Catch-all resolver

One handler for every entity:

```typescript
import { buildSelectSql } from "@meshql/sqlite";

mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...params);
});
```

A specific `mesh.resolve("user", fn)` always wins over `"*"`.

## Examples

- [express-sqlite](../examples/express-sqlite) — Node built-in SQLite
- [express-postgres](../examples/express-postgres) — optional `DATABASE_URL`
