# @meshql/sqlite

SQLite helper for MeshQL. Builds parameterised `SELECT` statements from a
join plan; runs on Node 22.5+'s built-in `node:sqlite` (no native deps).

```bash
pnpm add @meshql/core @meshql/sqlite
```

```ts
import { DatabaseSync } from "node:sqlite";
import { createMesh, type MeshSchema } from "@meshql/core";
import { buildSelectSql } from "@meshql/sqlite";

const db = new DatabaseSync(":memory:");
const schema: MeshSchema = { /* … */ };
const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...params);
});
```

## What you get

- Positional `?` parameter placeholders
- Double-quoted aliases (SQLite preserves case)
- One `LEFT JOIN` per declared `JoinConfig`

## Why SQLite first-class

- Zero native dependencies — `node:sqlite` is built into Node 22.5+
- Hermetic tests run inline with `:memory:`; no Docker, no service container
- Works on Bun's built-in SQLite and Cloudflare D1 (D1 accepts `?`-style)
- Lets you trial MeshQL without standing up a database server

For the Postgres-flavoured equivalent see [`@meshql/postgres`](../postgres).
