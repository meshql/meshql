# MeshQL showcase

A small **blog API** that exercises the full MeshQL stack in one place:

| Feature | Where |
|---------|--------|
| Field selection + nested joins | `post.author`, `post.comments.author` |
| List queries (`$list`) | limit, orderBy, filter, cursor |
| Catch-all resolver | `mesh.resolve("*", …)` + `@meshql/sqlite` |
| Integrity (login + signed queries) | `@meshql/integrity` |
| Field access | guests cannot see `user.email` |
| Row access | guests cannot open draft posts |
| Uploads | `user.avatar` → `./uploads/` |
| Client SDK | all demos use `@meshql/client` |

Zero Docker — uses Node 22.5+ `node:sqlite` (`:memory:` by default).

## Quick start

From the monorepo root:

```bash
pnpm install && pnpm build
pnpm --filter showcase start
```

In another terminal:

```bash
pnpm --filter showcase demo
```

The demo script logs in as guest / author / admin and walks through every feature.

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| `guest@example.com` | `demo` | guest — published posts only, no emails |
| `ada@example.com` | `demo` | author — drafts + avatar upload |
| `admin@example.com` | `demo` | admin — sees `user.email` |
| `grace@example.com` | `demo` | author |

## Manual curl (optional)

```bash
# Login
curl -s -X POST http://localhost:3010/mesh/auth \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"demo"}'
```

Prefer `pnpm --filter showcase demo` — it signs requests correctly.

## Layout

```
src/
  server.ts   # mesh wiring (integrity, access, upload, catch-all)
  schema.ts   # users, posts, comments
  db.ts       # sqlite schema + seed
  demo.ts     # feature tour
```

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3010` | HTTP port |
| `MESH_SECRET` | `showcase-secret` | Integrity HMAC secret |
| `SQLITE_FILE` | `:memory:` | Persist DB to a file path |
| `SHOWCASE_URL` | `http://localhost:3010/mesh` | Demo client base URL |
