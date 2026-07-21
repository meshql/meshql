# 04 — Response shaper

**Status:** Draft  
**Applies to:** Compliance Level 1+

The shaper converts **flat relational rows** into the nested JSON selection
shape. Implementations that only use nested ORM results MAY skip this step
if outputs already match the query.

## Inputs

1. Query AST / selection tree
2. Zero or more flat rows: `Record<string, unknown>[]`
3. Join list (`ResolvedJoin[]`) with `path` and `type`

## Row key aliases

For a scalar field `field` on root entity / table prefix `nodeName`:

| Preference | Key form | Example |
|------------|----------|---------|
| 1 | `{nodeName}_{field}` | `user_id`, `posts_title` |
| 2 | `{nodeName}.{field}` | `user.id` |
| 3 | `{field}` | `id` (fallback) |

For a joined path, replace `.` in the join path with `_` (`joinPathAlias`):

| Path | Alias prefix | Field key |
|------|--------------|-----------|
| `comments` | `comments` | `comments_body` |
| `comments.author` | `comments_author` | `comments_author_name` |

SQL builders SHOULD emit these aliases so the shaper can find columns
unambiguously when the same entity appears twice (e.g. `post.author` and
`comments.author`).

## Nesting rules

1. Walk the selection tree depth-first.
2. For each `many` join, group child objects by the join entity’s `idField`
   (or by full row identity when id is missing) under an array.
3. For each `one` join, attach a single object or omit / null if no matching
   columns are present in any row.
4. Dedupe `many` children when Cartesian products repeat the same id across
   flat rows.

## Example

Flat rows:

```json
[
  {
    "posts_id": 1,
    "posts_title": "Hello",
    "comments_id": 10,
    "comments_body": "Nice",
    "comments_author_name": "Ada"
  },
  {
    "posts_id": 1,
    "posts_title": "Hello",
    "comments_id": 11,
    "comments_body": "Agreed",
    "comments_author_name": "Grace"
  }
]
```

Shaped (illustrative):

```json
{
  "id": 1,
  "title": "Hello",
  "comments": [
    { "id": 10, "body": "Nice", "author": { "name": "Ada" } },
    { "id": 11, "body": "Agreed", "author": { "name": "Grace" } }
  ]
}
```

## Fixtures

See [fixtures/responses](./fixtures/responses/).
