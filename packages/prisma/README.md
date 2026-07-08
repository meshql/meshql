# @meshql/prisma

Prisma catch-all resolver for MeshQL. Maps `JoinPlan` to nested Prisma `select`, `where`, and list args. Register with `{ preshaped: true }` because Prisma returns nested JSON directly.

**v0.7.0+** can also build your MeshQL schema from `schema.prisma` via `schemaFromPrisma`.

## Install

```bash
npm install meshql-prisma meshql-core @prisma/client
# or
npx jsr add @meshql/prisma @meshql/core
npm i @prisma/client
```

Published on npm as `meshql-prisma` and [JSR](https://jsr.io/@meshql/prisma) as `@meshql/prisma`.

Requires `@meshql/core` **0.7.0+** (`extendSchema` + schema inference support).

## Example — infer schema from Prisma

```ts
import { PrismaClient } from "@prisma/client";
import { createMesh, extendSchema } from "@meshql/core";
import { schemaFromPrisma, withPrisma } from "@meshql/prisma";

const prisma = new PrismaClient();
const schema = extendSchema(await schemaFromPrisma("./prisma/schema.prisma"), {
  // optional: hide fields clients shouldn't select
  entities: { user: { fields: ["id", "name"] } },
});
const mesh = createMesh(schema);

withPrisma(mesh, prisma, { schema });
```

## Example — hand-written schema

```ts
import { PrismaClient } from "@prisma/client";
import { createMesh, type MeshSchema } from "@meshql/core";
import { withPrisma } from "@meshql/prisma";

const prisma = new PrismaClient();
const schema: MeshSchema = { /* entities + joins */ };
const mesh = createMesh(schema);

withPrisma(mesh, prisma, { schema });
```

Equivalent to:

```ts
import { prismaResolver } from "@meshql/prisma";

mesh.resolve("*", prismaResolver(prisma, { schema }), { preshaped: true });
```

- MeshQL entity `user` → `prisma.user`
- Point reads use `findUnique`; lists use `findMany` with `plan.list` filters

Create `PrismaClient` once per process — see [Database connections](../../docs/database-connections.md).

Runnable demo: [examples/express-prisma](../../examples/express-prisma).

## Exports

- `schemaFromPrisma(path)` / `schemaFromPrismaSource(source)` — infer `MeshSchema`
- `withPrisma(mesh, client, { schema })` — register catch-all resolver
- `prismaResolver(client, { schema })` — resolver function
- `buildPrismaSelect`, `buildPrismaWhere`, `buildPrismaListArgs` — lower-level mapping helpers

See also [ORM adapters](../../docs/orm-adapters.md).
