# JSR package settings

Some JSR score factors are configured on [jsr.io](https://jsr.io), not in the repository.

For each package (`core`, `http`, `client`, `upload`), open **Settings** on the package page and set:

## Description

| Package | Suggested description |
| --- | --- |
| `@meshql/core` | Parser, planner, shaper, and executor for client-driven field selection over REST APIs. |
| `@meshql/http` | HTTP transport and Express, Fastify, and Hono adapters for MeshQL. |
| `@meshql/client` | Typed MeshQL client SDK with automatic query encoding. |
| `@meshql/upload` | Optional file upload extension for MeshQL servers. |

## Runtime compatibility

Mark these as **Supported** for all four packages:

- Deno
- Node.js
- Bun

Optionally mark **Cloudflare Workers** as **Unknown support** unless you have tested there.

## Readme source

Leave the default **JSDoc (with Readme fallback)** so module docs and README both count toward documentation score.

After changing settings, republish or wait for the next release; scores update when documentation is regenerated on publish.
