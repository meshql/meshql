# Database connections

MeshQL does **not** create, pool, or close database connections. Your app owns the client (`PrismaClient`, Drizzle `db`, Kysely, `pg.Pool`, `node:sqlite` `DatabaseSync`, etc.). You pass that instance into a resolver at startup; MeshQL calls it on every request.

## Request flow

```
HTTP request
    → meshExpressRouter(mesh)
    → mesh.execute(query)
    → resolver(plan)          ← your code / ORM adapter
    → prisma / drizzle / pg / sqlite
```

MeshQL plans the query and shapes the response. Connection lifecycle stays in your stack.

## The pattern: create once, close over

Create the database handle **once** when your app starts. Register a resolver that uses the same instance via a JavaScript closure.

**Correct (per process):**

```typescript
const prisma = new PrismaClient();
const mesh = createMesh(schema);
withPrisma(mesh, prisma, { schema });
```

**Avoid (per request):**

```typescript
mesh.resolve("*", async (plan) => {
  const prisma = new PrismaClient(); // new pool every request
  // ...
});
```

ORM adapters (`withPrisma`, `withDrizzle`, `withKysely`) follow the per-process pattern.

## By stack

### Postgres (`pg.Pool`)

```typescript
import { Pool } from "pg";
import { createMesh } from "@meshql/core";
import { buildSelectSql } from "@meshql/postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const mesh = createMesh(schema);

mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return (await pool.query(sql, params)).rows;
});
```

The pool hands out connections per query and returns them. You do not open/close manually per request.

### SQLite (`node:sqlite`)

```typescript
import { DatabaseSync } from "node:sqlite";
import { buildSelectSql } from "@meshql/sqlite";

export const db = new DatabaseSync("app.db");

mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...params);
});
```

One `DatabaseSync` instance is typical for the process. Plugins (auth, access) can share the same `db` export.

### Prisma

```typescript
import { PrismaClient } from "@prisma/client";
import { withPrisma } from "@meshql/prisma";

const prisma = new PrismaClient();
withPrisma(mesh, prisma, { schema });
```

Prisma manages its own connection pool inside `PrismaClient`. MeshQL calls `findUnique` / `findMany` on the shared client.

See [ORM adapters](./orm-adapters.md) and the [express-prisma example](../examples/express-prisma).

### Drizzle

```typescript
import { withDrizzle } from "@meshql/drizzle";

withDrizzle(mesh, db, { schema });
```

Uses your existing Drizzle instance and `db.query.*` relational API.

### Kysely

```typescript
import { withKysely } from "@meshql/kysely";

withKysely(mesh, db, { schema, dialect: "postgres" });
```

Executes MeshQL join plans as parameterized SQL through `db.executeQuery()`. Flat rows go through the MeshQL shaper (no `{ preshaped: true }`).

## Lifecycle ownership

| Concern | Owner |
|--------|--------|
| Create connection / pool | **Your app** |
| Pool sizing, `DATABASE_URL` | **Your app** |
| Per-request query execution | **Resolver** (shared client) |
| Open/close per HTTP request | **Not MeshQL** |
| Graceful shutdown | **Your app** |

### Shutdown

On process exit, close what you opened:

```typescript
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  // or: await pool.end();
});
```

MeshQL has no shutdown hooks today.

## Serverless

Use your provider's pattern (one Prisma client per warm instance, connection limiters, etc.). Register **one client per instance**, not per invocation.

## Multiple databases

MeshQL does not multiplex connections. Options:

- Branch inside a catch-all resolver on `plan.rootEntity`
- Use entity-specific resolvers that call different clients
- Run separate mesh instances per database

## Transactions

MeshQL has no built-in transaction API. For writes inside a transaction:

- Run mutations outside MeshQL with your ORM, or
- Use a custom resolver that starts a transaction on your client and passes a transactional delegate (e.g. Prisma interactive transactions)

Read paths through ORM adapters are ordinary `findMany` / `findFirst` calls on the shared client — no implicit transaction per MeshQL query.

## Related

- [SQL integration](./sql-integration.md) — `buildSelectSql` and flat rows
- [ORM adapters](./orm-adapters.md) — Prisma, Drizzle, Kysely catch-all resolvers
