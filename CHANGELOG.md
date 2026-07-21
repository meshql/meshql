# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Per-package changelogs** (used by Changesets for releases) live under `packages/*/CHANGELOG.md`.

## [Unreleased]

## [0.7.1] - 2026-07-09

### Changed

- **`@meshql/core` 0.7.1** — shaper performance: `shapeRefMany` grouping rewritten from O(N²) nested scans to O(N) single-pass `Map`; `makeFieldReader()` caches resolved row aliases in hot loops (`shapeMany` + `shapeRefMany`). Up to ~138× faster on heavy many-join fanout. Response shapes unchanged.
- **List validation** — legacy list fields reject dotted cross-entity paths with a clear 400 (the current replacement is documented in the [read controls spec](./specs/05-read-controls.md)).

### Dependencies

- Patch bumps across the workspace (`updateInternalDependencies: patch`) for packages that depend on `@meshql/core`.

## [0.7.0] - 2026-07-08

### Added

- **`extendSchema()`** in `@meshql/core` — override inferred schemas (hide fields, add/remove joins)
- **`schemaFromPrisma()` / `schemaFromPrismaSource()`** in `@meshql/prisma` — build `MeshSchema` from `schema.prisma` via `@mrleebo/prisma-ast`
- **`schemaFromDrizzle()`** in `@meshql/drizzle` — build `MeshSchema` from Drizzle table + `relations()` exports
- **`examples/express-prisma`** now uses `schemaFromPrisma` (no hand-written MeshQL schema)

## [0.6.0] - 2026-07-06

### Added

- **`@meshql/prisma`** (`meshql-prisma`) — catch-all Prisma resolver with nested `select`, list filters, and `withPrisma()` helper
- **`@meshql/drizzle`** (`meshql-drizzle`) — catch-all resolver for Drizzle's relational query API (`db.query.*`)
- **`@meshql/kysely`** (`meshql-kysely`) — catch-all resolver executing join plans via Kysely + `buildSelectSql`
- **`@meshql/core` 0.6.0** — `{ preshaped: true }` resolver option (skip shaper for ORM nested results), ORM plan-relation helpers (`buildPlanRelationTree`, `buildOrmListQuery`, …), `encodeCursor` / `decodeCursor` exported from core
- **`examples/express-prisma`** — runnable Prisma + SQLite blog demo
- **Docs** — [ORM adapters](./docs/orm-adapters.md), [Database connections](./docs/database-connections.md), [SQL integration](./docs/sql-integration.md)

## [0.1.2] - 2026-06-18

### Added

- Per-package `README.md` files with usage examples for JSR documentation score
- Module-level JSDoc (`@module`, `@example`) on all JSR entrypoints
- JSDoc on exported public APIs across all publishable packages
- `docs/jsr-settings.md` with JSR description and runtime compatibility checklist

## [0.1.1] - 2026-06-18

### Added

- `@meshql/core` - parser, planner, shaper, `createMesh()`, `buildSelectSql()`
- `@meshql/http` - header transport, Express / Fastify / Hono adapters
- `@meshql/client` - typed client SDK with automatic query encoding
- `@meshql/upload` - opt-in file upload extension
- `examples/express-postgres` - end-to-end demo with in-memory and Postgres modes

### Fixed

- JSR publish rewrites `workspace:*` deps to `jsr:` specifiers in CI before publish
