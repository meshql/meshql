# Changelog

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
