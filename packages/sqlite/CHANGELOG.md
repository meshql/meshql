# Changelog

## 0.5.0

### Patch Changes

- Fix SQL SELECT table names when join ref names differ from table names (e.g. `author` → `users`).


## 0.4.1

### Patch Changes

- Updated dependencies
  - @meshql/core@0.5.0

## 0.4.0

### Minor Changes

- v0.4.0: list queries, filters, cursors, and catch-all resolver.
  - **New:** `JoinPlan.list` with `ListOptions` (limit, cursor, orderBy, filter). List metadata travels in the signed JSON wire payload as `$list`.
  - **New:** Catch-all resolver via `mesh.resolve("*", fn)`; specific entity resolvers always win.
  - **New:** `@meshql/postgres` and `@meshql/sqlite` builders generate parameterized `WHERE`/`ORDER BY`/`LIMIT` and keyset cursor predicates; `encodeCursor` / `decodeCursor` helpers exported.
  - **New:** `@meshql/client` `list` option serializes `$list` into the signed `X-Mesh-Query` header.

### Patch Changes

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

## @meshql/sqlite

## [Unreleased]

## [0.1.0] - initial release

### Added

- `buildSelectSql(plan, schema, options?)` — produces `SELECT` statements
  with positional `?` parameter placeholders for SQLite-style databases.
- Designed against Node 22.5+'s built-in `node:sqlite` (no native
  compilation). Also works with Bun's built-in SQLite, Cloudflare D1, and
  any client that accepts `?`-style placeholders.
- End-to-end test suite runs hermetically against `:memory:` — no Docker,
  no service container, in the default `pnpm test` run.
