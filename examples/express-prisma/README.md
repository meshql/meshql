# express-prisma

MeshQL blog API backed by Prisma — one catch-all resolver, nested reads included.

## Quick start

```bash
pnpm --filter express-prisma db:push
pnpm --filter express-prisma start
pnpm --filter express-prisma demo
```

The server registers:

```ts
withPrisma(mesh, prisma, { schema });
```

which is equivalent to:

```ts
mesh.resolve("*", prismaResolver(prisma, { schema }), { preshaped: true });
```
