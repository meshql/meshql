# express-prisma

MeshQL blog API backed by Prisma — schema inferred from `schema.prisma`, one catch-all resolver, nested reads included.

## Quick start

```bash
pnpm --filter express-prisma db:push
pnpm --filter express-prisma start
pnpm --filter express-prisma demo
```

The server does:

```ts
const schema = await schemaFromPrisma("./prisma/schema.prisma");
const mesh = createMesh(schema);
withPrisma(mesh, prisma, { schema });
```

No hand-written MeshQL schema required. Hide fields with `extendSchema`:

```ts
import { extendSchema } from "@meshql/core";

const schema = extendSchema(await schemaFromPrisma(path), {
  entities: { user: { fields: ["id", "name"] } },
});
```
