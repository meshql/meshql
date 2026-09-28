# MeshQL showcase

Full-stack blog demo built with **React** + **`@meshql/client`**. All browser
traffic goes to **`/mesh/*`** — login, reads, writes, and uploads.

| Network call | Purpose |
|--------------|---------|
| `POST /mesh/auth` | Login via `createAuthClient().login()` |
| `GET /mesh/post` | Collection read with signed `$where` / `$orderBy` / `$page` controls |
| `GET /mesh/post/:id` | Post detail |
| `GET /mesh/user/:id` | Profile (field access demo) |
| `GET /mesh/user` | Authors panel: each author's latest posts and their comments grouped by day, in one SQL statement |
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

Read rows in the sheet also have an **SQL** tab with the statement the server
ran and its bound parameters — sign in as guest vs admin to see the access
filter appear in the `WHERE` clause. This is a demo-only side channel
(`X-Showcase-Trace` header + `GET /showcase/sql/:id`); don't expose executed
SQL from a real API.

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

### Authors panel (nested per-parent reads)

The **Authors** panel under the dashboard is one query with three layers:
every author, their 3 latest posts, and each post's 5 latest comments grouped
by day. `$orderBy`, `$page` and `$groupBy` on `posts` and `comments` apply per
parent row, so every author gets their own 3 posts and every post its own 5
comments.

```ts
user: {
  $select: {
    name: true,
    posts: {
      $select: {
        title: true,
        comments: {
          $select: { body: true, author: { $select: { name: true } } },
          $orderBy: [{ field: "createdAt", direction: "desc" }],
          $page: { first: 5 },
          $groupBy: [{ field: "createdAt", bucket: "day", as: "date" }],
          $aggregate: { count: { fn: "count", field: "*" } },
        },
      },
      $orderBy: [{ field: "createdAt", direction: "desc" }],
      $page: { first: 3 },
    },
  },
  $where: { field: "role", op: "eq", value: "author" },
}
```

Open the `GET /mesh/user` row's **SQL** tab: the whole tree is a single
statement. Sign in as guest and the drafts disappear from each author's list,
because `guest-post-filter` in `src/mesh.ts` adds a `status = ?` filter (bound to
`"published"`) to the nested `posts` as well as the top-level post list. The full query is in
`src/web/AuthorsPanel.tsx`.

The seed data only loads into an empty database. A `SQLITE_FILE` created
before this panel existed won't have the extra posts and comments, so delete
it (or point at a new file) to see several day buckets per post.

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3010` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address (behind a reverse proxy) |
| `MESH_SECRET` | `showcase-secret` | Integrity HMAC secret. **Set this in production.** |
| `SQLITE_FILE` | `:memory:` | Persist the DB to a file so data survives restarts |
| `PUBLIC_ORIGIN` | `https://showcase.meshql.dev` | Public URL used in server logs |
| `SHOWCASE_SQL_TRACE` | on | Set to `0` to hide the network sheet's **SQL** tab and `GET /showcase/sql/:id` |

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
