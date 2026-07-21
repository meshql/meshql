# Changelog

## 0.7.1

### Patch Changes

- Updated dependencies [674ba44]
  - @meshql/core@0.8.1

## 0.7.0

### Minor Changes

- 9687686: Replace legacy `$list` collection queries with JSON read controls as the single query protocol.

  **Breaking changes (0.x minor):**
  - Remove `$list`, `X-Mesh-Version`, and `protocolVersion` negotiation.
  - Collection queries use `$select`, `$where`, `$orderBy`, `$page`, `$groupBy`, `$aggregate`, `$having`, and `$distinct`.
  - List responses use `{ data: { items, pageInfo }, meta }`; point reads use `{ data: object | null, meta }`.
  - Rename public APIs: `parseQueryV2` → `parseJsonQuery`, `CursorPayloadV2` → `ReadCursorPayload`, `encodeCursorV2`/`decodeCursorV2` → `encodeReadCursor`/`decodeReadCursor`, `QueryV2Document` → `QueryDocument`, `ExecuteResultV2` → `ExecuteResult`.
  - Client SDK: replace `list` options with read controls (`page`, `orderBy`, `where`, etc.).

  **Migration:**
  - Replace `$list: { limit, cursor, orderBy, where }` with `$page: { first, after }`, `$orderBy`, and `$where` on the same node.
  - Update client code from `client.query({ ..., list: { ... } })` to read-control fields.
  - Update response handling from flat arrays / v1 envelopes to `data.items` + `data.pageInfo`.
  - See `specs/05-read-controls.md` for the active protocol contract.

### Patch Changes

- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
  - @meshql/core@0.8.0

## 0.6.0

### Minor Changes

- Add persisted query registration and `X-Mesh-Query-Id` transport for production apps.

## 0.5.4

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.1

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

- Updated dependencies
  - @meshql/core@0.5.1

## 0.5.0

### Minor Changes

- v0.5.0: native multipart uploads with signed contentHash.
  - **New:** `mesh.executeUpload()` and `onUpload` plugin hook for file uploads.
  - **New:** Real local filesystem storage; S3 and R2 adapters (peer-dep gated).
  - **New:** `busboy` multipart parsing and upload routes on Express, Fastify, and Hono.
  - **New:** Integrity verifies `contentHash` in the signed wire payload against file bytes.
  - **New:** `client.upload({ entity, field, id?, file })` hashes and signs automatically.

### Patch Changes

- Updated dependencies
  - @meshql/core@0.5.0
  - @meshql/http@0.3.0

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
  - @meshql/http@0.2.1

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
  - @meshql/http@0.2.0

## 0.1.4

### Patch Changes

- 6f71bd3: Update README with the full package list, npm install flow, and security packages. Patch release across all publishable packages to test the Changesets tag workflow.
- Updated dependencies [6f71bd3]
  - @meshql/http@0.1.4

## @meshql/client

## [Unreleased]

## [0.1.3] - 2026-06-19

### Changed

- npm and JSR versions synced; release workflow uses Changesets.

## [0.1.2] - 2026-06-18

### Added

- Module-level JSDoc and package README for JSR documentation score.

## [0.1.1] - 2026-06-18

### Added

- Typed client SDK with automatic query encoding.
