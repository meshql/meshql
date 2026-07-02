# Changelog

## 0.2.1

### Patch Changes

- v0.4.0: list queries, filters, cursors, and catch-all resolver.
  - **New:** `JoinPlan.list` with `ListOptions` (limit, cursor, orderBy, filter). List metadata travels in the signed JSON wire payload as `$list`.
  - **New:** Catch-all resolver via `mesh.resolve("*", fn)`; specific entity resolvers always win.
  - **New:** `@meshql/postgres` and `@meshql/sqlite` builders generate parameterized `WHERE`/`ORDER BY`/`LIMIT` and keyset cursor predicates; `encodeCursor` / `decodeCursor` helpers exported.
  - **New:** `@meshql/client` `list` option serializes `$list` into the signed `X-Mesh-Query` header.

- Updated dependencies
  - @meshql/core@0.3.0

## 0.2.0

### Minor Changes

- 754dc25: v0.2.0: split SQL builders into `@meshql/postgres` and `@meshql/sqlite`, improve shaper join handling, and refresh HTTP adapters.
  - **Breaking:** `buildSelectSql` removed from `@meshql/core` — import from `@meshql/postgres` or `@meshql/sqlite` instead.
  - **New:** `@meshql/postgres` (`meshql-postgres`) with Postgres `$1, $2, …` placeholders and integration tests.
  - **New:** `@meshql/sqlite` (`meshql-sqlite`) with `?` placeholders for `node:sqlite` / Bun / D1.
  - **New:** `examples/express-sqlite` — zero-Docker SQLite demo.
  - **Improved:** shaper handles multi-many joins, left joins, and qualified row keys more reliably.
  - **Improved:** plugin runner and rate-limit plugin; HTTP adapter cleanup.

### Patch Changes

- Updated dependencies [754dc25]
  - @meshql/core@0.2.0

## 0.1.4

### Patch Changes

- 6f71bd3: Update README with the full package list, npm install flow, and security packages. Patch release across all publishable packages to test the Changesets tag workflow.
- Updated dependencies [6f71bd3]
  - @meshql/core@0.1.4

## @meshql/http

## [Unreleased]

## [0.1.3] - 2026-06-19

### Changed

- npm and JSR versions synced; release workflow uses Changesets.

## [0.1.2] - 2026-06-18

### Added

- Module-level JSDoc and package README for JSR documentation score.

## [0.1.1] - 2026-06-18

### Added

- Header transport, Express / Fastify / Hono adapters.
