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
