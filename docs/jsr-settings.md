# JSR package settings

Some JSR score factors are configured on [jsr.io](https://jsr.io), not in the repository.

For each publishable package, open **Settings** on the package page and set:

## Packages

| Package | Create on JSR | Link `meshql/meshql` |
| --- | --- | --- |
| `@meshql/core` | done | done |
| `@meshql/http` | done | done |
| `@meshql/client` | done | done |
| `@meshql/upload` | done | done |
| `@meshql/integrity` | **before first release** | **before first release** |
| `@meshql/access` | **before first release** | **before first release** |
| `@meshql/plugins` | **before first release** | **before first release** |

Steps for each new package:

1. [jsr.io/new](https://jsr.io/new) → create under `@meshql` scope.
2. Package **Settings** → **GitHub repository** → enter `meshql/meshql` → **Link**.

## Description

| Package | Suggested description |
| --- | --- |
| `@meshql/core` | Parser, planner, shaper, and executor for client-driven field selection over REST APIs. |
| `@meshql/http` | HTTP transport and Express, Fastify, and Hono adapters for MeshQL. |
| `@meshql/client` | Typed MeshQL client SDK with automatic query encoding. |
| `@meshql/upload` | Optional file upload extension for MeshQL servers. |
| `@meshql/integrity` | Request integrity and signing helpers for MeshQL HTTP servers. |
| `@meshql/access` | Access control helpers for MeshQL resources. |
| `@meshql/plugins` | Optional plugins extending MeshQL core. |

## Runtime compatibility

Mark these as **Supported** for all publishable packages:

- Deno
- Node.js
- Bun

Optionally mark **Cloudflare Workers** as **Unknown support** unless you have tested there.

## Readme source

Leave the default **JSDoc (with Readme fallback)** so module docs and README both count toward documentation score.

After changing settings, republish or wait for the next release; scores update when documentation is regenerated on publish.
