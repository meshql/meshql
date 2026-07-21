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
import { createMesh } from "@meshql/core";
import { buildSelectSql } from "@meshql/postgres"; // or @meshql/sqlite

const schema = {
  entities: {
    user: {
      fields: ["id", "email"],
      table: "users",
    },
    token: {
      fields: ["accessToken"],
      table: "tokens",
    },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many" as const,
    },
  },
};

const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const sql = buildSelectSql(plan, mesh.schema);
  return db.query(sql.sql, sql.params);
});

const user = await mesh.execute(
  JSON.stringify({
    user: {
      $select: {
        id: true,
        email: true,
        tokens: { $select: { accessToken: true } },
      },
    },
  }),
  {
    format: "json",
    context: { requestId: "req-1", method: "GET", entityId: "1" },
  },
);
```

JSON is the default and full query format. QL brace syntax is also supported
when you pass `{ format: "ql" }`:

```ts
await mesh.execute("{ user { id email tokens { accessToken } } }", {
  format: "ql",
  context: { requestId: "req-1", method: "GET", entityId: "1" },
});
```

## Computed fields

Declare virtual fields with physical dependencies:

```ts
const schema = {
  entities: {
    user: {
      fields: ["id", "firstName", "lastName"],
      computed: {
        fullName: {
          from: ["firstName", "lastName"],
          compute: ({ firstName, lastName }) =>
            `${firstName ?? ""} ${lastName ?? ""}`.trim(),
          type: "string",
        },
      },
    },
  },
  joins: {},
};
```

Clients select `fullName` normally under `$select`. MeshQL fetches its
dependencies and omits them from the response unless they were also selected.
Computed fields may also depend on one declared `join.field` path.

See the [computed fields guide](../../docs/computed-fields.md) for querying,
cross-entity dependencies, resolver behavior, access control, and limitations.

JSR import: `@meshql/core`.
