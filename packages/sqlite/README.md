# @meshql/sqlite

SQLite helper for MeshQL. Builds parameterised `SELECT` statements from a join
plan (`?` placeholders). Compatible with:

- Node 22.5+ [`node:sqlite`](https://nodejs.org/api/sqlite.html) (`DatabaseSync`)
- Bun [`bun:sqlite`](https://bun.com/docs/runtime/sqlite) (`Database`)
- Cloudflare D1 and other SQLite engines that bind positional `?` params

MeshQL does not open the database — your app owns the driver handle.

## Install

```bash
npm install meshql-sqlite meshql-core
# or
npx jsr add @meshql/sqlite @meshql/core
```

Published on [npm](https://www.npmjs.com/package/meshql-sqlite) as `meshql-sqlite` and [JSR](https://jsr.io/@meshql/sqlite) as `@meshql/sqlite`.

## Example (Node `node:sqlite`)

```ts
import { DatabaseSync } from "node:sqlite";
import { createMesh, type MeshSchema } from "meshql-core";
import { buildSelectSql } from "meshql-sqlite";

const db = new DatabaseSync(":memory:");
const schema: MeshSchema = { /* … */ };
const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...params);
});
```

## Example (Bun `bun:sqlite`)

```ts
import { Database } from "bun:sqlite";
import { createMesh, type MeshSchema } from "@meshql/core";
import { buildSelectSql } from "@meshql/sqlite";

const db = new Database(":memory:");
const schema: MeshSchema = { /* … */ };
const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.query(sql).all(...params);
});
```

Runnable demos: [examples/express-sqlite](../../examples/express-sqlite) (Node),
[examples/bun-sqlite](../../examples/bun-sqlite) (Bun + Hono).

JSR imports: `@meshql/core`, `@meshql/sqlite`.

See also [`@meshql/postgres`](../postgres).
