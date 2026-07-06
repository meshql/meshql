# @meshql/postgres

Postgres helper for MeshQL. Builds parameterised `SELECT` statements from a join plan; you supply the connection.

## Install

```bash
npm install meshql-postgres meshql-core pg
# or
npx jsr add @meshql/postgres @meshql/core
npm i pg
```

Published on [npm](https://www.npmjs.com/package/meshql-postgres) as `meshql-postgres` and [JSR](https://jsr.io/@meshql/postgres) as `@meshql/postgres`.

## Example

```ts
import { createMesh, type MeshSchema } from "meshql-core";
import { buildSelectSql } from "meshql-postgres";
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

JSR imports: `@meshql/core`, `@meshql/postgres`.

See also [`@meshql/sqlite`](../sqlite).
