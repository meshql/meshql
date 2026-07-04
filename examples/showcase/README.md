# MeshQL showcase

Interactive **full-stack blog** that exercises the MeshQL stack in the browser
(HTMX UI + signed MeshQL API).

| Feature | Try it |
|---------|--------|
| Integrity login | Switch **Guest / Ada / Admin** in the left panel |
| Field selection | Toggle title, body, status, author, comments |
| List + `$list` | Change limit, orderBy, status filter — list updates live |
| Cursor pagination | **Load more** |
| Field access | As guest, `user.email` is stripped; as admin it appears |
| Row access | As guest, open a draft — empty / denied |
| Uploads | Upload an avatar (signed `contentHash`) |
| Wire inspector | Right panel shows the signed payload and MeshQL JSON response |

Zero Docker — Node 22.5+ `node:sqlite` (`:memory:` by default).

## Quick start

```bash
pnpm install && pnpm build
pnpm --filter showcase start
```

Open **http://localhost:3010/**

Optional CLI tour (same API):

```bash
pnpm --filter showcase demo
```

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| `guest@example.com` | `demo` | published posts only, no emails |
| `ada@example.com` | `demo` | author — drafts + avatar upload |
| `admin@example.com` | `demo` | sees `user.email` |

## Layout

```
src/
  server.ts     # Express: UI + /mesh API
  mesh.ts       # MeshQL wiring
  ui.ts         # HTMX pages & partials
  mesh-call.ts  # signed execute / upload helpers
  session.ts    # cookie sessions
  schema.ts / db.ts / demo.ts
public/
  styles.css
```

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3010` | HTTP port |
| `MESH_SECRET` | `showcase-secret` | Integrity HMAC secret |
| `SQLITE_FILE` | `:memory:` | Persist DB to a file |
