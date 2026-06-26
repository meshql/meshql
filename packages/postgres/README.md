# @meshql/postgres

Postgres helper for MeshQL. Builds parameterised `SELECT` statements from a
join plan; you supply the connection.

```bash
pnpm add @meshql/core @meshql/postgres pg
```

```ts
import { createMesh, type MeshSchema } from "@meshql/core";
import { buildSelectSql } from "@meshql/postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const schema: MeshSchema = { /* … */ };
const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  const result = await pool.query(sql, params);
  return result.rows;
});
```

## What you get

- Numbered parameter placeholders (`$1`, `$2`, …)
- Double-quoted aliases so camelCase columns survive Postgres
  identifier case-folding
- One `LEFT JOIN` per declared `JoinConfig`

## What you don't get

- An ORM. Bring your own.
- A migration runner.
- Mutation builders. v1.0 surface is read-only.

For a SQLite-flavoured equivalent see [`@meshql/sqlite`](../sqlite).
