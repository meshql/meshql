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

## Runtime compatibility

Mark these as **Supported** for all publishable packages:

- Deno
- Node.js
- Bun

Mark **Browser** as **Supported** for `@meshql/client` (uses fetch + Web Crypto).

Optionally mark **Cloudflare Workers** as **Unknown support** unless you have tested there.

## Readme source

Leave the default **JSDoc (with Readme fallback)** so module docs and README both count toward documentation score.

After changing settings, republish or wait for the next release; scores update when documentation is regenerated on publish.
