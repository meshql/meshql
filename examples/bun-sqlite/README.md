# bun-sqlite

A minimal MeshQL example on **Bun** using the built-in
[`bun:sqlite`](https://bun.com/docs/runtime/sqlite) driver — **no Docker, no
native build step**. Defaults to an in-memory database; set
`SQLITE_FILE=./db.sqlite` to persist across restarts.

Uses Hono + `@meshql/http/hono` (natural fit for Bun's `fetch` server).

## Run

From the monorepo root (after `pnpm install && pnpm build`):

```bash
pnpm --filter bun-sqlite start
```

Or with watch:

```bash
pnpm --filter bun-sqlite dev
```

In another terminal:

```bash
pnpm --filter bun-sqlite demo
```

You should see:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "tokens": [
    { "accessToken": "tok_ada_1" },
    { "accessToken": "tok_ada_2" }
  ]
}
```

## Resolver shape

`@meshql/sqlite` only builds SQL (`?` placeholders). You run it with Bun's API:

```ts
import { Database } from "bun:sqlite";
import { buildSelectSql } from "@meshql/sqlite";

const db = new Database(":memory:");

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.query(sql).all(...params);
});
```

Compare with Node's [`express-sqlite`](../express-sqlite) example, which uses
`node:sqlite` `DatabaseSync` the same way.
