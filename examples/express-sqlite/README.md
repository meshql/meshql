# express-sqlite

A minimal MeshQL example that runs on Node 22.5+'s built-in
[`node:sqlite`](https://nodejs.org/api/sqlite.html) — **no Docker, no native
build step, no external service**. Defaults to an in-memory database; set
`SQLITE_FILE=./db.sqlite` to persist across restarts.

## Run

```bash
pnpm install
pnpm --filter express-sqlite dev
```

In another terminal:

```bash
pnpm --filter express-sqlite demo
```

You should see:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "tokens": [
    { "accessToken": "tok_ada_1", "expiresAt": "2026-12-31" },
    { "accessToken": "tok_ada_2", "expiresAt": "2027-01-15" }
  ]
}
```

## Try a query by hand

MeshQL puts the query in an `X-Mesh-Query` header (base64 of the JSON form):

```bash
Q=$(printf '%s' '{"user":{"$select":{"id":true,"name":true,"tokens":{"$select":{"accessToken":true,"expiresAt":true}}}}}' | base64)
curl -H "X-Mesh-Query: $Q" -H "X-Mesh-Format: json" http://localhost:3003/mesh/user/1
```

Response:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "tokens": [
    { "accessToken": "tok_ada_1", "expiresAt": "2026-12-31" },
    { "accessToken": "tok_ada_2", "expiresAt": "2027-01-15" }
  ]
}
```

## Per-parent limits and grouping

"Every user, their top 5 posts, and each post's last 10 comments grouped by
day" is one query:

```bash
pnpm --filter express-sqlite demo:nested
```

```ts
await client.query({
  user: {
    $select: {
      id: true,
      name: true,
      posts: {
        $select: {
          id: true,
          title: true,
          score: true,
          comments: {
            $select: { id: true, createdAt: true, author: { $select: { name: true } } },
            $orderBy: [{ field: "createdAt", direction: "desc" }],
            $page: { first: 10 },
            $groupBy: [{ field: "createdAt", bucket: "day", as: "date" }],
            $aggregate: { count: { fn: "count", field: "*" } },
          },
        },
        $orderBy: [{ field: "score", direction: "desc" }],
        $page: { first: 5 },
      },
    },
    $page: { first: 20 },
  },
});
```

`$orderBy`, `$page` and `$groupBy` on `posts` and `comments` apply **per
parent row**: Ada has 7 posts but gets her top 5, and each post keeps its own
10 latest comments, bucketed by day:

```json
{
  "items": [
    {
      "id": 1,
      "name": "Ada Lovelace",
      "posts": [
        {
          "id": 1,
          "title": "Notes on the Analytical Engine",
          "score": 70,
          "comments": [
            {
              "date": "2026-09-28",
              "count": 3,
              "items": [
                { "id": 15, "createdAt": "2026-09-28T11:00:00Z", "author": { "name": "Grace Hopper" } },
                { "id": 14, "createdAt": "2026-09-28T10:00:00Z", "author": { "name": "Ada Lovelace" } },
                { "id": 13, "createdAt": "2026-09-28T09:00:00Z", "author": { "name": "Grace Hopper" } }
              ]
            },
            { "date": "2026-09-27", "count": 3, "items": ["..."] },
            { "date": "2026-09-26", "count": 3, "items": ["..."] },
            { "date": "2026-09-25", "count": 1, "items": ["..."] }
          ]
        }
      ]
    }
  ],
  "pageInfo": { "hasNextPage": false, "startCursor": "...", "endCursor": "..." }
}
```

It is still **one SQL statement**. Start the server with `LOG_SQL=1` to see
it: plain selections log `[flat]` (the usual `LEFT JOIN`), while queries with
per-parent controls log `[nested]`, with each relation as a correlated
`json_group_array` subquery. The resolver is unchanged; the planner picks the
strategy. See [SQL integration](../../docs/sql-integration.md#per-parent-relation-controls).

## How small is the actual code?

`src/server.ts` is under 90 lines including imports, most of it the schema. The mesh resolver is:

```ts
mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...(params as SqliteParam[]));
});
```

That's it. Everything else is schema declaration and Express boilerplate.
