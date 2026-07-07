# Changelog

## 0.6.0

### Minor Changes

- v0.6.0: ORM adapters (Prisma, Drizzle, Kysely) and core support for preshaped resolvers, ORM plan-relation helpers, and cursor exports. Includes `examples/express-prisma` and ORM documentation.

## 0.6.0

### Minor Changes

- v0.6.0: ORM adapter support in core.
  - **New:** `{ preshaped: true }` on `mesh.resolve()` — skip shaper when resolver returns nested JSON (Prisma/Drizzle).
  - **New:** ORM helpers exported from `@meshql/core` — `buildPlanRelationTree`, `buildOrmListQuery`, `mapEntityField`, etc.
  - **New:** `encodeCursor` / `decodeCursor` exported from core for list pagination.

## 0.5.1

### Patch Changes

- Fix multi-level nested field selection: recursive join planning, multi-hop SQL joins with distinct table aliases, and recursive shaper. Queries like `post.comments.author.name` now execute end-to-end (previously parsed and validated but only one join hop was planned).

## 0.5.0

### Minor Changes

- v0.5.0: native multipart uploads with signed contentHash.
  - **New:** `mesh.executeUpload()` and `onUpload` plugin hook for file uploads.
  - **New:** Real local filesystem storage; S3 and R2 adapters (peer-dep gated).
  - **New:** `busboy` multipart parsing and upload routes on Express, Fastify, and Hono.
  - **New:** Integrity verifies `contentHash` in the signed wire payload against file bytes.
  - **New:** `client.upload({ entity, field, id?, file })` hashes and signs automatically.

## 0.4.0

### Minor Changes

- v0.4.0: list queries, filters, cursors, and catch-all resolver.
  - **New:** `JoinPlan.list` with `ListOptions` (limit, cursor, orderBy, filter). List metadata travels in the signed JSON wire payload as `$list`.
  - **New:** Catch-all resolver via `mesh.resolve("*", fn)`; specific entity resolvers always win.
  - **New:** `@meshql/postgres` and `@meshql/sqlite` builders generate parameterized `WHERE`/`ORDER BY`/`LIMIT` and keyset cursor predicates; `encodeCursor` / `decodeCursor` helpers exported.
  - **New:** `@meshql/client` `list` option serializes `$list` into the signed `X-Mesh-Query` header.

## 0.2.0

### Minor Changes

- 754dc25: v0.2.0: split SQL builders into `@meshql/postgres` and `@meshql/sqlite`, improve shaper join handling, and refresh HTTP adapters.
  - **Breaking:** `buildSelectSql` removed from `@meshql/core` — import from `@meshql/postgres` or `@meshql/sqlite` instead.
  - **New:** `@meshql/postgres` (`meshql-postgres`) with Postgres `$1, $2, …` placeholders and integration tests.
  - **New:** `@meshql/sqlite` (`meshql-sqlite`) with `?` placeholders for `node:sqlite` / Bun / D1.
  - **New:** `examples/express-sqlite` — zero-Docker SQLite demo.
  - **Improved:** shaper handles multi-many joins, left joins, and qualified row keys more reliably.
  - **Improved:** plugin runner and rate-limit plugin; HTTP adapter cleanup.

## 0.1.4

### Patch Changes

- 6f71bd3: Update README with the full package list, npm install flow, and security packages. Patch release across all publishable packages to test the Changesets tag workflow.

## @meshql/core

Per-package release notes. See also the [monorepo changelog](../../CHANGELOG.md).

## [Unreleased]

## [0.1.3] - 2026-06-19

### Changed

- npm and JSR versions synced; release workflow uses Changesets.

## [0.1.2] - 2026-06-18

### Added

- Module-level JSDoc and package README for JSR documentation score.

## [0.1.1] - 2026-06-18

### Added

- Parser, planner, shaper, `createMesh()`, `buildSelectSql()`.
