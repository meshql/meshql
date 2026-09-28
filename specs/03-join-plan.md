# 03 — JoinPlan

**Status:** Draft  
**Applies to:** Compliance Level 1+

After parsing and validating a query, an implementation MUST produce a
**JoinPlan** (logical name; not required to be a public JSON API). Resolvers
consume this plan to fetch only requested data.

## Semantic fields

| Field | Type | Meaning |
|-------|------|---------|
| `rootEntity` | string | MeshQL entity key |
| `fields` | string[] | Qualified scalar selections for the root (and possibly joins, depending on implementation). The TS planner uses table-prefixed paths such as `users.id`. |
| `idField` | string | Identifying field on the root entity (default `id`) |
| `joins` | `ResolvedJoin[]` | Nested relations requested by the client |
| `read` | object? | Normalized selection and collection controls — see [05](./05-read-controls.md) |
| `context` | object | At least: request correlation, HTTP method, optional `entityId` for point reads |
| `strategy` | `"flat"` \| `"nested"` | How relations are fetched — see [Fetch strategy](#fetch-strategy) |

## ResolvedJoin

| Field | Type | Meaning |
|-------|------|---------|
| `path` | string | Dot-separated ref path from root selection, e.g. `comments` or `comments.author` |
| `joinKey` | string | Schema join key: `{parentEntityKey}.{refName}` e.g. `post.comments` or `comment.author` |
| `entity` | string | Target entity key |
| `on` | string | Join predicate / hint from schema (SQL-like string in the TS reference) |
| `fields` | string[] | Selected fields for this join hop |
| `type` | `"one"` \| `"many"` | Cardinality |
| `refName` | string | Last segment of `path` |
| `idField` | string | Identifying field of the joined entity (default `id`) |

## Example

Query: `post { id title comments { id body author { name } } }`

Illustrative plan:

```json
{
  "rootEntity": "post",
  "idField": "id",
  "fields": ["posts.id", "posts.title"],
  "joins": [
    {
      "path": "comments",
      "joinKey": "post.comments",
      "entity": "comment",
      "type": "many",
      "refName": "comments",
      "idField": "id",
      "on": "comments.post_id = posts.id",
      "fields": ["comments.id", "comments.body"]
    },
    {
      "path": "comments.author",
      "joinKey": "comment.author",
      "entity": "user",
      "type": "one",
      "refName": "author",
      "idField": "id",
      "on": "users.id = comments.author_id",
      "fields": ["users.name"]
    }
  ]
}
```

Exact string forms of `fields` / `on` may differ by SQL dialect adapters;
cardinality, paths, and join keys MUST remain consistent with the query tree.

## Point vs collection

- Point read: `context.entityId` is set.
- Collection read: `context.entityId` is absent and `read` carries the
  normalized controls, including the effective page and deterministic order.

## Fetch strategy

The planner chooses one strategy per query:

- **`flat`** — every relation is LEFT JOINed into one row set and the shaper
  re-nests it. Used when no relation carries per-parent controls, and for
  root aggregate reads.
- **`nested`** — used when any `many` relation (at any depth) has an explicit
  `$where`, `$orderBy`, `$page`, `$groupBy` or `$aggregate`. Each relation is
  fetched per parent row (the TS SQL builders render correlated subqueries
  that return JSON, still in one statement), so its controls apply to each
  parent independently and the root page counts root rows. The whole tree
  switches, because mixing flat `many` joins with per-parent relations would
  multiply rows again.

Implementations SHOULD reject `nested` plans they cannot honor rather than
silently dropping per-parent controls (the TS ORM adapters do not yet honor
them). Polymorphic relations MAY be rejected in `nested` plans.

A SQL builder that renders the `nested` strategy marks its rows as nested
(TS: `plan.rowFormat = "nested"`) so the executor parses JSON relation columns
instead of running the flat shaper.

## Preshaped resolvers

An implementation MAY skip the shaper if the resolver returns already-nested
JSON matching the selection (TS: `{ preshaped: true }`). That behavior is an
optimization; the JoinPlan remains the source of truth for what was requested.
