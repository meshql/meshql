# Changelog

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
