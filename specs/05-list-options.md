# 05 — List options (`$list`)

**Status:** Draft (protocol v1)  
**Applies to:** Compliance Level 2+

List metadata lives **inside** the signed / query payload as a sibling key
`$list`, not as URL query parameters. This keeps filters and page size under
the same integrity envelope as field selection (see [06](./06-integrity.md)).

## When it applies

- Route: `GET /{base}/:entity` (no `:id`)
- Query JSON includes `"$list": { ... }` alongside the entity selection

## Shape

```json
{
  "user": { "id": true, "name": true },
  "$list": {
    "limit": 20,
    "cursor": "eyJpZCI6MTAwfQ",
    "orderBy": [{ "field": "name", "dir": "asc" }],
    "filter": [{ "field": "role", "op": "eq", "value": "admin" }]
  }
}
```

## Fields

| Key | Type | Notes |
|-----|------|-------|
| `limit` | integer | Default **50**, max **200** (TS reference). Implementations SHOULD clamp. |
| `cursor` | string | Opaque keyset cursor (base64 JSON in TS: `{ "id": ... }`) |
| `orderBy` | array | `{ "field": string, "dir": "asc" \| "desc" }[]` |
| `filter` | array | `{ "field": string, "op": FilterOp, "value": unknown }[]` |

### Filter operators

`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `like`, `ilike`

`in` / `nin` use array `value`. Unknown ops → `ValidationError`.

### Field references

`filter[].field` and `orderBy[].field` MUST name a field declared on the
**root entity's** `fields[]`. Dotted paths (e.g. `author.name`,
`comments.body`) are **not valid** and MUST produce a `ValidationError`
(HTTP 400).

Rationale: cross-entity filtering and ordering through `many` relations
has three legitimate SQL translations (`any`, `all`, `first-by-order`)
and no unambiguous default. Rather than pick one silently, MeshQL keeps
the wire protocol simple and predictable — applications that need such
queries SHOULD write a resolver that translates the plan into their
database's native operators.

```json
// valid
{ "$list": { "filter": [{ "field": "role", "op": "eq", "value": "admin" }] } }

// invalid — rejected with a 400
{ "$list": { "filter": [{ "field": "author.name", "op": "eq", "value": "Ada" }] } }
```

This is a permanent design decision. Implementations MUST NOT add
implicit path traversal to `filter[].field` or `orderBy[].field` in
future protocol versions.

## JoinPlan attachment

When `$list` is present (or programmatically supplied), the JoinPlan’s
`list` property MUST carry the normalized options for the resolver.

## Response

List endpoints return a **JSON array** of shaped objects. Pagination cursors
in responses are **not** mandated in v1 (clients may re-encode last id);
implementations MAY add envelope metadata in a later protocol version.
