# @meshql/core

Parser, planner, shaper, and executor for client-driven field selection over REST.

## Install

```bash
npm install meshql-core
# or
npx jsr add @meshql/core
```

Published on [npm](https://www.npmjs.com/package/meshql-core) as `meshql-core` and [JSR](https://jsr.io/@meshql/core) as `@meshql/core`.

## Example

```ts
import { buildSelectSql, createMesh } from "meshql-core";

const mesh = createMesh({
  entities: {
    user: {
      table: "users",
      joins: { tokens: { table: "tokens", on: "user_id" } },
    },
  },
});

mesh.resolve("user", async (plan) => {
  const sql = buildSelectSql(plan, mesh.schema);
  return db.query(sql.text, sql.params);
});

const user = await mesh.execute("user { id email tokens { accessToken } }", {
  context: { requestId: "req-1", method: "GET" },
});
```

JSR import: `@meshql/core`.
