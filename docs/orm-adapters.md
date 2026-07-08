# ORM adapters

**v0.6.0** added catch-all resolvers for Prisma, Drizzle, and Kysely. **v0.7.0** adds schema inference — you can skip hand-writing `MeshSchema` and import it from your ORM.

MeshQL still owns parsing, planning, list filters, and access plugins. The adapter maps `JoinPlan` → ORM calls.

## When to use which adapter

| Adapter | Best for | Returns | Shaper |
|---------|----------|---------|--------|
| `@meshql/prisma` | Existing Prisma apps | Nested JSON from Prisma `select` | Skipped (`preshaped: true`) |
| `@meshql/drizzle` | Drizzle relational query API | Nested JSON from `with` | Skipped (`preshaped: true`) |
| `@meshql/kysely` | Kysely + raw SQL control | Flat aliased rows | Runs (like `buildSelectSql`) |
| `@meshql/postgres` / `@meshql/sqlite` | Full SQL control | Flat aliased rows | Runs |

Prisma and Drizzle return already-nested objects, so register with `{ preshaped: true }`. Kysely uses the same SQL builders as the Postgres/SQLite packages.

## Shared requirements

1. **MeshQL schema** — hand-written, or inferred via `schemaFromPrisma` / `schemaFromDrizzle`. Entity names should match Prisma model keys or Drizzle `db.query` keys.
2. **Catch-all resolver** — `mesh.resolve("*", …)`. Entity-specific resolvers always override `"*"`.
3. **Shared DB client** — create once at startup; see [Database connections](./database-connections.md).

## Schema inference (v0.7.0)

```typescript
import { createMesh, extendSchema } from "@meshql/core";
import { schemaFromPrisma, withPrisma } from "@meshql/prisma";

const schema = extendSchema(await schemaFromPrisma("./prisma/schema.prisma"), {
  entities: { user: { fields: ["id", "name"] } }, // hide email / role
});

const mesh = createMesh(schema);
withPrisma(mesh, prisma, { schema });
```

Drizzle:

```typescript
import { schemaFromDrizzle, withDrizzle } from "@meshql/drizzle";
import * as tables from "./db/schema.js";

const schema = schemaFromDrizzle(tables);
withDrizzle(mesh, db, { schema });
```

`extendSchema` from `@meshql/core` merges overrides: entity `fields` arrays are **replaced** (so you can hide), and joins can be added or removed.

## Prisma

### Install

```bash
npm install meshql-prisma meshql-core @prisma/client
# or
npx jsr add @meshql/prisma @meshql/core
```

### Setup

```typescript
import { PrismaClient } from "@prisma/client";
import { createMesh } from "@meshql/core";
import { schemaFromPrisma, withPrisma } from "@meshql/prisma";

const prisma = new PrismaClient();
const schema = await schemaFromPrisma("./prisma/schema.prisma");
const mesh = createMesh(schema);

withPrisma(mesh, prisma, { schema });
```

`withPrisma` is equivalent to:

```typescript
import { prismaResolver } from "@meshql/prisma";

mesh.resolve("*", prismaResolver(prisma, { schema }), { preshaped: true });
```

### Schema mapping

- MeshQL entity `user` → `prisma.user` delegate
- Join `post.comments` → nested `select: { comments: { select: { … } } }`
- `table` / `columns` on entities map MeshQL field names to DB columns for filters and ordering

### Example

Runnable demo: [examples/express-prisma](../examples/express-prisma).

```bash
pnpm --filter express-prisma db:push
pnpm --filter express-prisma start
```

Package reference: [packages/prisma/README.md](../packages/prisma/README.md).

## Drizzle

### Install

```bash
npm install meshql-drizzle meshql-core drizzle-orm
# or
npx jsr add @meshql/drizzle @meshql/core
```

### Setup

```typescript
import { schemaFromDrizzle, withDrizzle } from "@meshql/drizzle";
import * as tables from "./db/schema.js";

const schema = schemaFromDrizzle(tables);
withDrizzle(mesh, db, { schema });
```

Requires Drizzle's relational query API: `db.query.posts.findMany({ with: { … } })`. Entity `post` with `table: "posts"` maps to `db.query.posts`.

Package reference: [packages/drizzle/README.md](../packages/drizzle/README.md).

## Kysely

### Install

```bash
npm install meshql-kysely meshql-core meshql-postgres kysely
# SQLite: meshql-sqlite instead of meshql-postgres
# or
npx jsr add @meshql/kysely @meshql/core @meshql/postgres
```

### Setup

```typescript
import { withKysely } from "@meshql/kysely";

withKysely(mesh, db, { schema, dialect: "postgres" });
```

Kysely executes parameterized SQL from `@meshql/postgres` or `@meshql/sqlite`. Returns flat rows; the MeshQL shaper nests the response.

```typescript
import { kyselyResolver } from "@meshql/kysely";

mesh.resolve("*", kyselyResolver(db, { schema, dialect: "sqlite" }));
// no { preshaped: true }
```

Package reference: [packages/kysely/README.md](../packages/kysely/README.md).

## List queries and point reads

All three adapters support:

- **Point read** — `GET /mesh/post/1` → `findUnique` / `findFirst` with `where` from `plan.context.entityId`
- **List** — `plan.list` with limit, cursor, `orderBy`, and filters (mapped to ORM/SQL equivalents)

Use `@meshql/client` with the `list` option; it serializes `$list` into the signed query payload.

## Nested fields

Multi-level nesting (e.g. `post.comments.author.name`) is supported end-to-end since v0.5.1. ORM adapters build nested `select` / `with` trees from the join plan.

## What's not included yet

- Automatic transaction wrapping
- Write/mutation resolvers (reads only in adapters)
- `schemaFromKysely` (Kysely still uses a hand-written MeshSchema + SQL builders)

## Related

- [Database connections](./database-connections.md)
- [SQL integration](./sql-integration.md)
- [Concepts](./concepts.md) — JoinPlan and shaper
