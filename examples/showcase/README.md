# MeshQL showcase

Full-stack blog demo built with **React** + **`@meshql/client`**. All browser
traffic goes to **`/mesh/*`** — login, reads, writes, and uploads.

| Network call | Purpose |
|--------------|---------|
| `POST /mesh/auth` | Login via `createAuthClient().login()` |
| `GET /mesh/post` | Collection read with signed `$where` / `$orderBy` / `$page` controls |
| `GET /mesh/post/:id` | Post detail |
| `GET /mesh/user/:id` | Profile (field access demo) |
| `POST /mesh/post` | Create post (REST preview) |
| `PATCH /mesh/post/:id` | Update post (REST preview) |
| `DELETE /mesh/post/:id` | Delete post (REST preview) |
| `POST /mesh/comment` | Create comment (REST preview) |
| `DELETE /mesh/comment/:id` | Delete comment (REST preview) |
| `POST /mesh/user/:id/avatar` | Avatar upload via `client.upload()` |

The dashboard **MeshQL network** sheet (bottom of the page) streams recent
client calls like a browser DevTools network panel. Selecting a post opens a
signed SSE subscription; live updates show in the detail view, a header
activity bell, and as events on the same SSE row in the network sheet.

Hosted demo: **https://showcase.meshql.dev** — a shared sandbox; posts are not
private.

## Quick start

```bash
pnpm install && pnpm build
pnpm --filter showcase start   # builds React app, then serves
```

Open **http://localhost:3010/**

### Dev with hot reload

Terminal 1 — API server:

```bash
pnpm --filter showcase dev
```

Terminal 2 — Vite (proxies `/mesh` → :3010):

```bash
pnpm --filter showcase dev:web
```

Open **http://localhost:5173/**

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| `guest@example.com` | `demo` | read published posts only |
| `ada@example.com` | `demo` | author — create & edit own posts |
| `admin@example.com` | `demo` | full access |

## Layout

```
index.html              # Vite entry
vite.config.ts
src/
  server.ts             # Express: SPA + /mesh API + REST writes
  web/                  # React app (@meshql/client via MeshProvider)
    main.tsx
    MeshContext.tsx     # createAuthClient, query, write, upload, wire log
    NetworkSheet.tsx    # DevTools-style /mesh inspector
    NotificationBell.tsx # SSE live activity bell + toasts
    LoginPage.tsx
    DashboardPage.tsx
    ...
  mesh.ts / crud.ts / write-handler.ts
public/                 # Vite build output + styles.css
```

### Live activity (SSE)

1. Sign in and select a post — detail shows a **live** badge when the SSE
   stream is open (`GET /mesh/post/:id/events`).
2. In another tab (or as another user), comment or edit that post.
3. Watch the header bell, toast, post detail, and network sheet update together.

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3010` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address (behind a reverse proxy) |
| `MESH_SECRET` | `showcase-secret` | Integrity HMAC secret. **Set this in production.** |
| `SQLITE_FILE` | `:memory:` | Persist the DB to a file so data survives restarts |
| `PUBLIC_ORIGIN` | `https://showcase.meshql.dev` | Public URL used in server logs |

See [`.env.example`](./.env.example). The process trusts `X-Forwarded-*` so HTTPS
behind Caddy/nginx is correct. Client calls stay on relative `/mesh`.

## Standalone zip (linux-x64)

Build a self-contained deployable archive (bundled Node 22 + `server.mjs` +
static assets — no `pnpm` / `node_modules` on the host):

```bash
pnpm --filter showcase pack:release
```

Produces `examples/showcase/release/meshql-showcase-linux-x64-<version>.zip`.

On the server:

```bash
unzip meshql-showcase-linux-x64-*.zip
cd meshql-showcase-linux-x64-*
cp .env.example .env   # set MESH_SECRET; optionally SQLITE_FILE outside this dir
./run.sh
```

Point `SQLITE_FILE` (and keep `uploads/`) outside the unzip folder if you want
data to survive replacing the zip on redeploy.
