# @meshql/sqlite

SQLite helper for MeshQL. Builds parameterised `SELECT` statements from a join plan; runs on Node 22.5+'s built-in `node:sqlite` (no native deps).

## Install

```bash
npm install @meshqljs/sqlite @meshqljs/core
# or
npx jsr add @meshql/sqlite @meshql/core
```

Published on [npm](https://www.npmjs.com/package/@meshqljs/sqlite) as `@meshqljs/sqlite` and [JSR](https://jsr.io/@meshql/sqlite) as `@meshql/sqlite`.

## Example

```ts
import { DatabaseSync } from "node:sqlite";
import { createMesh, type MeshSchema } from "@meshqljs/core";
import { buildSelectSql } from "@meshqljs/sqlite";

const db = new DatabaseSync(":memory:");
const schema: MeshSchema = { /* … */ };
const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...params);
});
```

JSR imports: `@meshql/core`, `@meshql/sqlite`.

See also [`@meshql/postgres`](../postgres).
