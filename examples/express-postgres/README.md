# express-postgres

Runnable MeshQL server with **in-memory** or **Postgres** storage. Includes optional security demos (monorepo only — not on JSR 0.1.x yet).

> **Postgres or in-memory.** Default mode uses in-memory seed data — no database setup required. For SQLite, see [`express-sqlite`](../express-sqlite).

## Prerequisites

- Node.js 22+
- pnpm (from monorepo root)

## Quick start (in-memory)

From the monorepo root (`meshql/`):

```bash
pnpm install
pnpm build
pnpm --filter express-postgres start
```

Server: `http://localhost:3001`

### Test with the client

```bash
pnpm --filter express-postgres exec tsx src/demo-client.ts
```

### Test with curl

```bash
Q=$(echo -n '{"user":{"id":true,"name":true,"tokens":{"accessToken":true,"expiresAt":true}}}' | base64 | tr -d '\n')

curl -s "http://localhost:3001/mesh/user/1" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json" | jq

curl -s "http://localhost:3001/mesh/user" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json" | jq

curl -s http://localhost:3001/health | jq
```

## Postgres mode (optional)

```bash
cd examples/express-postgres
docker compose up -d
```

From monorepo root:

```bash
export DATABASE_URL=postgresql://meshql:meshql@localhost:5432/meshql
pnpm --filter express-postgres seed
pnpm --filter express-postgres start
```

## Environment variables

Copy `.env.example` or export manually:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `DATABASE_URL` | *(unset)* | Unset = in-memory; set = Postgres |
| `MESH_SECRET` | *(unset)* | Unset = security disabled |
| `MESH_INTEGRITY` | *(unset)* | Set to `1` with `MESH_SECRET` for full token auth |

### Security modes

| `MESH_SECRET` | `MESH_INTEGRITY` | Mode |
|---------------|------------------|------|
| unset | — | Security disabled (default) |
| set | unset | Basic HMAC + role access + depth limit |
| set | `1` | Full integrity (`POST /mesh/auth`) |

### Basic HMAC mode

```bash
export MESH_SECRET=dev-secret
pnpm --filter express-postgres start
```

Unsigned requests (like default `demo-client.ts`) will fail with `401`. Use a client with `secret` or test via monorepo development.

### Full integrity mode

```bash
export MESH_SECRET=dev-secret
export MESH_INTEGRITY=1
pnpm --filter express-postgres start
```

```bash
pnpm --filter express-postgres exec tsx src/demo-secure-client.ts
```

Login credentials (demo only): `demo@example.com` / `demo`

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm --filter express-postgres start` | Start server |
| `pnpm --filter express-postgres dev` | Start with watch |
| `pnpm --filter express-postgres seed` | Seed Postgres |
| `pnpm --filter express-postgres exec tsx src/demo-client.ts` | Basic client |
| `pnpm --filter express-postgres exec tsx src/demo-secure-client.ts` | Integrity client |

## Related

- [Run example guide](../../docs/run-example.md) — JSR install + curl from scratch
- [HTTP adapters](../../docs/http-adapters.md)
