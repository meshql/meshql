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
| `$page` | collection roots, `many` relations | Forward keyset page (`first`, `after`); `first` only on `many` relations |
| `$groupBy` | collection roots, `many` relations | Group keys (field names or date buckets) |
| `$aggregate` | collection roots, grouped `many` relations | Named aggregate projections |
| `$having` | grouped collection roots | Post-aggregate filter |
| `$distinct` | collection roots | Distinct field list |

`$where`, `$orderBy`, `$page`, `$groupBy`, and `$aggregate` on `one` relations
MUST be rejected. On a `many` relation, controls apply **per parent row**
(e.g. each post's last 10 comments), not to the relation across all parents.
`$page.after` and `$having` on `many` relations MUST be rejected.

## Grouping

`$groupBy` keys are field names or objects:

```json
{ "field": "createdAt", "bucket": "day", "as": "date" }
```

| Key | Meaning |
|-----|---------|
| `field` | Physical field to group by |
| `bucket` | Optional date truncation: `hour`, `day`, `week`, `month`, `year` |
| `as` | Optional response name (identifier); defaults to `field` |

Bucketed keys render as ISO-8601 prefix strings: `2026-09-28T13:00` (hour),
`2026-09-28` (day), the Monday of the ISO week (week), `2026-09` (month),
`2026` (year). Group key names and aggregate aliases MUST be identifiers and
MUST be unique within a node.

**Collection roots** return one row per group: group keys plus aggregate
aliases. `$orderBy` may reference a group key by `as` name or source field;
group keys are appended as ascending tie-breakers.

**`many` relations** bucket records. `$where`, `$orderBy`, and `$page` first
select a window of records per parent; `$groupBy` then splits that window into
buckets and `$aggregate` (which requires `$groupBy` here) is computed per
bucket. Each bucket nests its records under the reserved key `items`:

```json
{
  "user": {
    "$select": {
      "posts": {
        "$select": {
          "comments": {
            "$select": { "id": true, "body": true },
            "$orderBy": [{ "field": "createdAt", "direction": "desc" }],
            "$page": { "first": 10 },
            "$groupBy": [{ "field": "createdAt", "bucket": "day", "as": "date" }],
            "$aggregate": { "count": { "fn": "count", "field": "*" } }
          }
        },
        "$orderBy": [{ "field": "score", "direction": "desc" }],
        "$page": { "first": 5 }
      }
    }
  }
}
```

```json
"comments": [
  { "date": "2026-09-28", "count": 3, "items": [{ "id": 12, "body": "..." }] },
  { "date": "2026-09-27", "count": 7, "items": [ ... ] }
]
```

Buckets are ordered by their keys, in the direction of the `$orderBy` entry on
the same field when present, otherwise ascending. Items keep record order.

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

Point reads return an object or `null`. Nested `many` relations return arrays
(of records, or of buckets when grouped); the root `$page` counts root rows.

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
