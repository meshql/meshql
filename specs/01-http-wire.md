# 01 — HTTP wire protocol

**Status:** Draft  
**Applies to:** Compliance Level 1+

## Base path

Adapters mount under a configurable base path. Unless otherwise noted, examples
use `/mesh`. Implementations MUST support remapping the base path.

## Routes (core — L1)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/{base}/:entity` | List read (or empty list selection) |
| `GET` | `/{base}/:entity/:id` | Point read |
| `POST` | `/{base}` | Complex query in JSON body |
| `PUT` | `/{base}/:entity/:id` | Point read with PUT transport (same query headers as GET) |

`:entity` is the MeshQL entity key (e.g. `user`). `:id` is the resource
primary key as a path segment (string; implementations MAY coerce numerics
when talking to storage).

Core write mutations (create/update/delete) are not part of the read protocol.
`DELETE` SHOULD return **405** until a mutation profile is specified.

## Routes (persisted queries — optional)

Persisted queries are an optional production optimization. When enabled,
clients MAY send a short query ID instead of the full base64 payload.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/{base}/queries` | Register `{ "query": "...", "format": "json" }` → `{ "id": "q_a3f1b2c8" }` |

Execution uses `X-Mesh-Query-Id` on GET/PUT instead of `X-Mesh-Query`.
The two headers are mutually exclusive.

## Routes (integrity — L3)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/{base}/auth` | Login — returns signing token material |
| `POST` | `/{base}/logout` | Revoke session |

## Routes (uploads — L4)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/{base}/:entity/:id/:field` | Multipart file upload (attach to existing) |
| `POST` | `/{base}/:entity` | Multipart upload (create) |

See [07 — Uploads](./07-uploads.md).

## Headers (GET / PUT)

| Header | Required | Description |
|--------|----------|-------------|
| `X-Mesh-Query` | One of `X-Mesh-Query` / `X-Mesh-Query-Id` | Base64-encoded query payload (UTF-8). Padding MAY be present. |
| `X-Mesh-Query-Id` | One of `X-Mesh-Query` / `X-Mesh-Query-Id` | Persisted query ID from `POST /{base}/queries` (e.g. `q_a3f1b2c8`) |
| `X-Mesh-Format` | No | `json` (default) or `ql` |
| `X-Mesh-Signature` | L3 | `sha256=` + hex HMAC over the **exact** `X-Mesh-Query` or `X-Mesh-Query-Id` header value |
| `X-Mesh-Token` | L3 | Opaque wire token from auth |

`X-Mesh-Query` and `X-Mesh-Query-Id` are mutually exclusive.
`X-Mesh-Query` MUST NOT be passed as a URL query parameter for L1 compliance.

### Encoding

1. Serialize the query as UTF-8 text (JSON string or QL string).
2. Base64-encode (standard alphabet). Strip newlines when transmitting.
3. Place the result in `X-Mesh-Query`.

## POST `/{base}` body

```json
{
  "query": "{\"user\":{\"$select\":{\"id\":true,\"name\":true}}}",
  "format": "json"
}
```

QL remains available when `format` is set to `ql`:

```json
{
  "query": "{ user { id name } }",
  "format": "ql"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `query` | Yes | Raw query string (not base64) |
| `format` | No | Defaults to `json` |

Content-Type: `application/json`.

## Successful response

- Status **200**
- Point read body: selected object or `null`
- Collection body: `{ "items": [...], "pageInfo": { "hasNextPage", "startCursor", "endCursor" } }`
- POST and docs proxies MAY wrap either result as `{ "data": ..., "meta": ... }`

## Error response

Status codes:

| Condition | Status | `error` field |
|-----------|--------|---------------|
| Missing / invalid transport (`X-Mesh-Query`) | 400 | `TransportError` |
| Unknown entity/field/join or invalid query | 400 | `ValidationError` |
| Integrity failure | 401 / 403 | `IntegrityError` (L3) |
| Resolver failure | 500 | `ResolverError` |
| Unexpected failure | 500 | `InternalError` |

Body shape:

```json
{
  "error": "ValidationError",
  "message": "Field 'secret' not found on entity 'user'"
}
```

Implementations MUST use JSON error bodies on failure for these routes.
Additional fields (e.g. `requestId`) are allowed.

## CORS / content types

Not normative. Implementations serving browsers SHOULD allow the `X-Mesh-*`
request headers.
