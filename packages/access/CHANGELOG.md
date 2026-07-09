# Changelog

## 0.2.6

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.1

## 0.2.5

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.0

## 0.2.4

### Patch Changes

- Updated dependencies
  - @meshql/core@0.6.0

## 0.2.3

### Patch Changes

- Updated dependencies
  - @meshql/core@0.5.1

## 0.2.2

### Patch Changes

- Updated dependencies
  - @meshql/core@0.5.0

## 0.2.1

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

## 0.1.1

### Patch Changes

- 6f71bd3: Update README with the full package list, npm install flow, and security packages. Patch release across all publishable packages to test the Changesets tag workflow.
- Updated dependencies [6f71bd3]
  - @meshql/core@0.1.4

## @meshql/access

## [Unreleased]

## [0.1.0] - 2026-06-19

### Added

- Initial release on npm; JSR publish pending package setup on jsr.io.
