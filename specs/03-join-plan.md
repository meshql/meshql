# 03 — JoinPlan

**Status:** Draft (protocol v1)  
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
| `list` | object? | Present only for list reads (L2) — see [05](./05-list-options.md) |
| `context` | object | At least: request correlation, HTTP method, optional `entityId` for point reads |

## ResolvedJoin

| Field | Type | Meaning |
|-------|------|---------|
| `path` | string | Dot-separated ref path from root selection, e.g. `comments` or `comments.author` |
| `joinKey` | string | Schema join key: `{parentAstName}.{refName}` e.g. `post.comments` |
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
      "joinKey": "comments.author",
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

## Point vs list

- Point read: `context.entityId` is set; `list` is absent.
- List read: `list` MAY be set; `entityId` is absent.

## Preshaped resolvers

An implementation MAY skip the shaper if the resolver returns already-nested
JSON matching the selection (TS: `{ preshaped: true }`). That behavior is an
optimization; the JoinPlan remains the source of truth for what was requested.
