---
"@meshql/core": minor
"@meshql/client": minor
"@meshql/http": minor
"@meshql/postgres": minor
"@meshql/sqlite": minor
"@meshql/docs": minor
"@meshql/prisma": patch
"@meshql/drizzle": patch
---

Replace legacy `$list` collection queries with JSON read controls as the single query protocol.

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
