# JSR package settings

Some JSR score factors are configured on [jsr.io](https://jsr.io), not in the repository.

For each publishable package, open **Settings** on the package page and set:

## Packages

| Package | Create on JSR | Link `meshql/meshql` |
| --- | --- | --- |
| `@meshql/core` | done | done |
| `@meshql/postgres` | done | done |
| `@meshql/sqlite` | done | done |
| `@meshql/http` | done | done |
| `@meshql/client` | done | done |
| `@meshql/upload` | done | done |
| `@meshql/integrity` | done | done |
| `@meshql/access` | done | done |
| `@meshql/prisma` | done | done |
| `@meshql/drizzle` | done | done |
| `@meshql/kysely` | done | done |
| `@meshql/persisted-queries` | done | done |
| `@meshql/access-cache` | done | done |
| `@meshql/pubsub` | done | done |
| `@meshql/sse` | done | done |
| `@meshql/codemods` | done | done |
| `@meshql/gateway` | done | done |
| `@meshql/docs` | done | done |

Steps for each new package:

1. [jsr.io/new](https://jsr.io/new) → create under `@meshql` scope.
2. Package **Settings** → **GitHub repository** → enter `meshql/meshql` → **Link**.

## Description

| Package | Suggested description |
| --- | --- |
| `@meshql/core` | Parser, planner, shaper, and executor for client-driven field selection over REST APIs. |
| `@meshql/postgres` | Postgres `buildSelectSql` with `$1`, `$2`, … placeholders. |
| `@meshql/sqlite` | SQLite `buildSelectSql` for Node `node:sqlite`, Bun, and D1. |
| `@meshql/http` | HTTP transport and Express, Fastify, and Hono adapters for MeshQL. |
| `@meshql/client` | Typed MeshQL client SDK — browser and Node, auth, list queries, uploads. |
| `@meshql/upload` | Multipart file uploads with signed `contentHash` verification. |
| `@meshql/integrity` | Request signing and integrity token lifecycle for MeshQL HTTP servers. |
| `@meshql/access` | Entity, row, and field access control for MeshQL. |
| `@meshql/prisma` | Prisma catch-all resolver — nested `select` from JoinPlan. |
| `@meshql/drizzle` | Drizzle relational query resolver for MeshQL. |
| `@meshql/kysely` | Kysely resolver executing MeshQL join plans as parameterized SQL. |
| `@meshql/persisted-queries` | Persisted query IDs for MeshQL HTTP transport and client auto-registration. |
| `@meshql/access-cache` | Cache MeshQL access permission results in memory, Upstash, or Redis-compatible stores. |
| `@meshql/pubsub` | Pub/sub for real-time subscriptions (memory, Redis, Postgres LISTEN/NOTIFY). |
| `@meshql/sse` | Field-aware MeshQL subscriptions over Server-Sent Events. |
| `@meshql/codemods` | GraphQL SDL → MeshQL schema migration tools and CLI. |
| `@meshql/gateway` | Static multi-service MeshQL gateway — parallel fetch and stitch (V1). |
| `@meshql/docs` | Interactive API playground — schema browser, query runner, SQL trace. |

## Runtime compatibility

Mark these as **Supported** for all publishable packages:

- Deno
- Node.js
- Bun

Mark **Browser** as **Supported** for `@meshql/client` (uses fetch + Web Crypto).

Optionally mark **Cloudflare Workers** as **Unknown support** unless you have tested there.

## Readme source

Each package **must** ship a root `README.md` (CI fails publish verify if it is missing).

The **Overview** tab uses the package **Readme Source** setting:

| Setting | Overview shows |
| --- | --- |
| **JSDoc (with Readme fallback)** (default) | Module `@module` JSDoc on the `.` export, or README if that is absent |
| **Readme** | Always the published `README.md` |

If Overview looks empty or only shows a short module blurb and you want the Install/Example README instead, open the package on JSR → **Settings** → **Readme Source** → **Readme**.

After changing settings, republish or wait for the next release; scores update when documentation is regenerated on publish.
