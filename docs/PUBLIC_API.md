# Public API surface (pre-1.0 audit)

Packages and entrypoints intended as semver-stable **before v1.0 freeze**. Internal modules, test helpers, and `dist/chunk-*` paths are not public.

| Package | Public exports | Notes |
|---------|----------------|-------|
| `@meshql/core` | `.`, `./builtins` | Parser, planner, shaper, plugins |
| `@meshql/postgres` | `.` | `buildSelectSql` |
| `@meshql/sqlite` | `.` | `buildSelectSql` |
| `@meshql/http` | `.`, `./express`, `./fastify`, `./hono` | Handlers + adapters |
| `@meshql/client` | `.` | `createClient`, `createAuthClient`, signing |
| `@meshql/pubsub` | `.`, `./redis`, `./postgres` | Stores + notify helpers |
| `@meshql/sse` | `.`, `./express`, `./fastify`, `./hono` | SSE handler + adapters |
| `@meshql/codemods` | `.` | SDL migration API + CLI bin |
| `@meshql/gateway` | `.` | `createGateway` V1 |
| `@meshql/integrity` | `.`, `./express` | Token lifecycle + router |
| `@meshql/access` | `.` | Access plugins |
| `@meshql/access-cache` | `.` | Permission cache |
| `@meshql/persisted-queries` | `.` | Query ID registry |
| `@meshql/upload` | `.` | Multipart uploads |
| `@meshql/prisma` | `.` | ORM resolver + schema inference |
| `@meshql/drizzle` | `.` | ORM resolver + schema inference |
| `@meshql/kysely` | `.` | SQL resolver |

**Not public:** deep imports into `packages/*/src/**` except documented `exports` in each `package.json` / `jsr.json`.

Heading to 1.0: breaking changes only via major bump after the freeze; mark new experimental APIs with `@experimental` in JSDoc until stabilized.
