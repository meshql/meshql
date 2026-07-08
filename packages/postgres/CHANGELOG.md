# Changelog

## 0.5.3

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.0

## 0.5.2

### Patch Changes

- Updated dependencies
  - @meshql/core@0.6.0

## 0.5.1

### Patch Changes

- Fix multi-level nested field selection: recursive join planning, multi-hop SQL joins with distinct table aliases, and recursive shaper. Queries like `post.comments.author.name` now execute end-to-end (previously parsed and validated but only one join hop was planned).
- Updated dependencies
  - @meshql/core@0.5.1

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
