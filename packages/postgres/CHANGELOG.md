# Changelog

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

## @meshql/postgres

## [Unreleased]

## [0.1.0] - initial release

### Added

- `buildSelectSql(plan, schema, options?)` — moved out of `@meshql/core` so
  the core engine is database-agnostic. Emits Postgres-style numbered
  parameter placeholders (`$1`, `$2`, …) and double-quoted identifiers.
- Postgres integration test guarding camelCase aliases, multi-many
  Cartesian dedup, and left-join no-match behaviour. Runs in CI against a
  Postgres 16 service container; locally via
  `DATABASE_URL=… pnpm --filter @meshql/postgres test:integration`.
