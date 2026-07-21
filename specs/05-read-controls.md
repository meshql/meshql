# 05 — Read controls

**Status:** Draft  
**Applies to:** JSON collection reads

MeshQL has one recursive JSON read protocol. Every collection node may carry
local controls; collection responses use `{ items, pageInfo }`.

## Wire format

```json
{
  "post": {
    "$select": {
      "id": true,
      "title": true,
      "comments": {
        "$select": { "id": true, "body": true },
        "$where": { "field": "body", "op": "like", "value": "%hello%" },
        "$orderBy": [{ "field": "id", "direction": "desc" }],
        "$page": { "first": 10 }
      }
    },
    "$where": { "field": "status", "op": "eq", "value": "published" },
    "$orderBy": [{ "field": "createdAt", "direction": "desc", "nulls": "last" }],
    "$page": { "first": 20 }
  }
}
```

Every read node uses `$select`. Fields outside `$select` and unknown `$` keys
MUST be rejected.

## Controls

| Key | Applies to | Meaning |
|-----|------------|---------|
| `$select` | all nodes | Field and relation selection |
| `$where` | collection roots, `many` relations | Boolean filter tree |
| `$orderBy` | collection roots, `many` relations | Multi-key sort |
| `$page` | collection roots, `many` relations | Forward keyset page (`first`, `after`) |
| `$groupBy` | collection roots | Group keys |
| `$aggregate` | collection roots | Named aggregate projections |
| `$having` | grouped collection roots | Post-aggregate filter |
| `$distinct` | collection roots | Distinct field list |

`$where`, `$orderBy`, and `$page` on `one` relations MUST be rejected.

## Filters

Operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `like`,
`ilike`, `isNull`, `isNotNull`.

Boolean composition uses `{ "and": [...] }`, `{ "or": [...] }`, and
`{ "not": ... }`.

## Results

Collection:

```json
{
  "items": [],
  "pageInfo": {
    "hasNextPage": false,
    "startCursor": null,
    "endCursor": null
  }
}
```

Point reads return an object or `null`.

## Cursors and limits

Cursors are opaque. A server MUST reject a cursor whose entity, relation path,
ordering, or query scope does not match the current read.

| Limit | Value |
|-------|-------|
| `first` default | 50 |
| `first` max | 200 |
| filter tree depth | 8 |
| filter nodes | 64 |
| `in` array size | 200 |
| `groupBy` keys | 8 |
| aggregate aliases | 16 |
