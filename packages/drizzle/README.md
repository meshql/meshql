# @meshql/drizzle

Drizzle catch-all resolver for MeshQL. Maps `JoinPlan` to Drizzle's relational query API (`db.query.*.findMany` / `findFirst` with `with`). Register with `{ preshaped: true }`.

## Install

```bash
npm install meshql-drizzle meshql-core drizzle-orm
# or
npx jsr add @meshql/drizzle @meshql/core
```

Published on npm as `meshql-drizzle` and [JSR](https://jsr.io/@meshql/drizzle) as `@meshql/drizzle`.

Requires `@meshql/core` **0.6.0+**.

## Example

```ts
import { createMesh, type MeshSchema } from "@meshql/core";
import { withDrizzle } from "@meshql/drizzle";

const schema: MeshSchema = { /* entities + joins */ };
const mesh = createMesh(schema);

withDrizzle(mesh, db, { schema });
```

Entity `post` with `table: "posts"` maps to `db.query.posts`. Nested joins become `with: { comments: { with: { … } } }`.

```ts
import { drizzleResolver } from "@meshql/drizzle";

mesh.resolve("*", drizzleResolver(db, { schema }), { preshaped: true });
```

Pass your existing Drizzle `db` instance — MeshQL does not create connections. See [Database connections](../../docs/database-connections.md).

## Exports

- `withDrizzle(mesh, db, { schema })`
- `drizzleResolver(db, { schema })`
- `buildDrizzleQuery`, `buildDrizzleWhere`, `drizzleQueryKey` — lower-level helpers

See also [ORM adapters](../../docs/orm-adapters.md).
