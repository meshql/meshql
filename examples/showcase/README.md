# MeshQL showcase

Full-stack blog demo built with **React** + **`@meshql/client`**. All browser
traffic goes to **`/mesh/*`** — login, reads, writes, and uploads.

| Network call | Purpose |
|--------------|---------|
| `POST /mesh/auth` | Login via `createAuthClient().login()` |
| `GET /mesh/post` | List posts (signed query + `$list`) |
| `GET /mesh/post/:id` | Post detail |
| `GET /mesh/user/:id` | Profile (field access demo) |
| `POST /mesh/write` | CRUD writes (preview until core mutations) |
| `POST /mesh/user/:id/avatar` | Avatar upload via `client.upload()` |

The dashboard **MeshQL network** panel shows recent client calls.

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
  server.ts             # Express: SPA + /mesh API + /mesh/write
  web/                  # React app (@meshql/client via MeshProvider)
    main.tsx
    MeshContext.tsx     # createAuthClient, query, write, upload
    LoginPage.tsx
    DashboardPage.tsx
    ...
  mesh.ts / crud.ts / write-handler.ts
public/                 # Vite build output + styles.css
```

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3010` | HTTP port |
| `MESH_SECRET` | `showcase-secret` | Integrity HMAC secret |
| `SQLITE_FILE` | `:memory:` | Persist DB to a file |
