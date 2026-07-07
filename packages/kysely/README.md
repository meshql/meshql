# @meshql/kysely

Kysely catch-all resolver for MeshQL. Executes join plans as parameterized SQL via `db.executeQuery()`, using `@meshql/postgres` or `@meshql/sqlite` builders. Returns flat rows — the MeshQL shaper nests the response (no `{ preshaped: true }`).

## Install

```bash
# Postgres
npm install meshql-kysely meshql-core meshql-postgres kysely

# SQLite
npm install meshql-kysely meshql-core meshql-sqlite kysely

# or JSR
npx jsr add @meshql/kysely @meshql/core @meshql/postgres
```

Published on npm as `meshql-kysely` and [JSR](https://jsr.io/@meshql/kysely) as `@meshql/kysely`.

Requires `@meshql/core` **0.6.0+**.

## Example

```ts
import { createMesh, type MeshSchema } from "@meshql/core";
import { withKysely } from "@meshql/kysely";

const schema: MeshSchema = { /* entities + joins */ };
const mesh = createMesh(schema);

withKysely(mesh, db, { schema, dialect: "postgres" });
```

Equivalent to:

```ts
import { kyselyResolver } from "@meshql/kysely";

mesh.resolve("*", kyselyResolver(db, { schema, dialect: "sqlite" }));
```

Pass your existing Kysely instance. MeshQL does not manage the connection pool — see [Database connections](../../docs/database-connections.md).

## Exports

- `withKysely(mesh, db, { schema, dialect })`
- `kyselyResolver(db, { schema, dialect })` — `dialect`: `"postgres"` | `"sqlite"`

See also [ORM adapters](../../docs/orm-adapters.md) and [`@meshql/postgres`](../postgres).
