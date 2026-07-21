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
curl -H "X-Mesh-Query: $Q" -H "X-Mesh-Format: json" http://localhost:3002/mesh/user/1
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

## How small is the actual code?

`src/server.ts` is ~50 lines including imports. The mesh resolver is:

```ts
mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...(params as SqliteParam[]));
});
```

That's it. Everything else is schema declaration and Express boilerplate.
