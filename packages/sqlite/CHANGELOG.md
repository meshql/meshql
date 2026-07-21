# Changelog

## 0.6.1

### Patch Changes

- Updated dependencies [674ba44]
  - @meshql/core@0.8.1

## 0.6.0

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
