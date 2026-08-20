# Contributing to MeshQL

Thank you for your interest in contributing to [MeshQL](https://github.com/meshql/meshql).

## Getting started

```bash
git clone https://github.com/meshql/meshql.git
cd meshql
pnpm install
pnpm build
pnpm test
```

Requirements: **Node.js 22+** (CI uses 24), **pnpm 11**.

## Development workflow

1. Fork the repository and create a branch from `main`.
2. Make your changes in the appropriate package under `packages/`.
3. Add or update tests in `@meshql/core` when changing engine behavior.
4. Run checks before opening a PR:

```bash
pnpm build
pnpm test
pnpm check-types
pnpm format
```

## Project structure

| Path | Purpose |
|------|---------|
| `packages/core` | Parser, planner, shaper, SQL builder |
| `packages/http` | HTTP transport and framework adapters |
| `packages/client` | Client SDK |
| `packages/upload` | Upload extension |
| `packages/integrity` | Request integrity / signing |
| `packages/access` | Access control helpers |
| `examples/` | Runnable examples |
| `docs/` | Usage guides |

HTTP setup: [docs/http-adapters.md](./docs/http-adapters.md).

## Releasing packages

MeshQL is a **pnpm + Turbo monorepo** with **independent per-package versions**. Each library can ship on its own schedule. npm and JSR share the same semver per package (`package.json` is the source of truth; `jsr.json` is synced automatically).

### Publishable packages

| Package | npm name | JSR name |
| --- | --- | --- |
| `@meshql/core` | `@meshql-js/core` | `@meshql/core` |
| `@meshql/postgres` | `@meshql-js/postgres` | `@meshql/postgres` |
| `@meshql/sqlite` | `@meshql-js/sqlite` | `@meshql/sqlite` |
| `@meshql/http` | `@meshql-js/http` | `@meshql/http` |
| `@meshql/client` | `@meshql-js/client` | `@meshql/client` |
| `@meshql/upload` | `@meshql-js/upload` | `@meshql/upload` |
| `@meshql/integrity` | `@meshql-js/integrity` | `@meshql/integrity` |
| `@meshql/access` | `@meshql-js/access` | `@meshql/access` |
| `@meshql/prisma` | `@meshql-js/prisma` | `@meshql/prisma` |
| `@meshql/drizzle` | `@meshql-js/drizzle` | `@meshql/drizzle` |
| `@meshql/kysely` | `@meshql-js/kysely` | `@meshql/kysely` |
| `@meshql/persisted-queries` | `@meshql-js/persisted-queries` | `@meshql/persisted-queries` |
| `@meshql/access-cache` | `@meshql-js/access-cache` | `@meshql/access-cache` |
| `@meshql/pubsub` | `@meshql-js/pubsub` | `@meshql/pubsub` |
| `@meshql/sse` | `@meshql-js/sse` | `@meshql/sse` |
| `@meshql/codemods` | `@meshql-js/codemods` | `@meshql/codemods` |
| `@meshql/gateway` | `@meshql-js/gateway` | `@meshql/gateway` |
| `@meshql/docs` | `@meshql-js/docs` | `@meshql/docs` |

`@meshql/typescript-config` is private and never published.

**Publish order** (when multiple packages release together): `core → postgres → sqlite → prisma → drizzle → kysely → http → upload → client → integrity → access → persisted-queries → access-cache → pubsub → sse → codemods → gateway → docs`.

### Standard release flow (Changesets)

1. **Add a changeset** in your feature PR when you ship user-facing changes:

```bash
pnpm changeset
```

Choose the affected package(s) and semver bump (patch / minor / major). This creates a file under `.changeset/`.

2. **Merge your PR** to `main`. If changesets are pending, CI opens or updates a **Version Packages** PR ([`.github/workflows/release.yml`](./.github/workflows/release.yml)).

   **One-time repo setting (required):** GitHub → **Settings** → **Actions** → **General** → enable **Read and write permissions** for workflows, and check **Allow GitHub Actions to create and approve pull requests**. Without this, the Version Packages PR cannot be opened automatically.

3. **Merge the Version Packages PR.** It bumps `package.json`, syncs `jsr.json`, and updates per-package `CHANGELOG.md` files.

4. **CI creates per-package tags** on `main`. Tag push triggers [publish.yml](./.github/workflows/publish.yml):
   - npm: `npm/{pkg}/v{version}` → publishes `@meshql-js/{pkg}`
   - JSR: `{pkg}/v{version}` → publishes `@meshql/{pkg}`

Example: releasing only `@meshql/core` at `0.1.4` pushes `npm/core/v0.1.4` and `core/v0.1.4` — no umbrella tag required.

### Manual release (fallback)

Bump `version` in `packages/{pkg}/package.json`, run `node scripts/sync-jsr-versions.mjs`, update the package `CHANGELOG.md`, commit, then:

```bash
git tag npm/core/v0.1.4
git tag core/v0.1.4
git push origin npm/core/v0.1.4 core/v0.1.4
```

Or use **Actions → Publish → Run workflow** to retry a package (choose registry: npm, jsr, or both) without retagging.

### Optional umbrella tags (legacy)

These still work but are **not** the primary release path:

| Tag | Publishes |
| --- | --- |
| `npm/all/v*` / `all/v*` | core, http, upload, client only |
| `npm/security/v*` / `security/v*` | integrity + access together |

## Publishing to JSR

JSR packages ship TypeScript source (`jsr.json` exports). CI rewrites `workspace:*` deps before publish.

### One-time JSR setup (required for each package)

JSR OIDC only works for packages **linked to your GitHub repo**. Creating `@meshql/core` is not enough.

For **each** publishable package:

1. Go to [jsr.io/new](https://jsr.io/new) and create it under the `@meshql` scope (if not created yet).
2. Open the package on JSR → **Settings** → **GitHub repository**.
3. Enter `meshql/meshql` and click **Link**.
4. Ensure `packages/{pkg}/README.md` exists (publish verify fails without it).

**Setup checklist:**

| Package | JSR created | GitHub linked |
| --- | --- | --- |
| `@meshql/core` | yes | yes |
| `@meshql/http` | yes | yes |
| `@meshql/client` | yes | yes |
| `@meshql/upload` | yes | yes |
| `@meshql/integrity` | yes | yes |
| `@meshql/access` | yes | yes |
| `@meshql/persisted-queries` | yes | yes |
| `@meshql/access-cache` | yes | yes |

Without linking, CI fails with `actorNotAuthorized` or `Following packages don't exist`. See [docs/jsr-settings.md](./docs/jsr-settings.md) for descriptions and runtime compatibility.

Tag-push publishes use GitHub OIDC (`id-token: write`) — no dispatch workaround. Keep `RELEASE_PAT` for the Changesets version PR only.

### Local JSR publish

```bash
pnpm build
pnpm publish:dry-run              # npm pack + jsr --dry-run for all packages
pnpm publish:local -- --registry jsr --package core --dry-run
pnpm publish:jsr                  # all publishable packages, in workspace order
```

Already-published versions are skipped automatically by `jsr publish`.

## Publishing to npm

Packages publish under the **`@meshql-js`** npm org as compiled ESM (`dist/`). Workspace and JSR names stay `@meshql/*`.

| Registry | Name | Example |
| --- | --- | --- |
| npm | `@meshql-js/<pkg>` | `npm i @meshql-js/core` |
| JSR | `@meshql/<pkg>` | `npx jsr add @meshql/core` |

### One-time npm setup

1. Create an [npm access token](https://www.npmjs.com/settings/~/tokens) with **Automation** or **Publish** scope (member of `@meshql-js`).
2. Add it to the GitHub repo:

```bash
gh secret set NPM_TOKEN --repo meshql/meshql
```

3. First publish of each package claims `@meshql-js/<pkg>` on npm.

### npm tag reference

| Trigger | Example | Publishes |
| --- | --- | --- |
| Per-package tag | `npm/core/v0.1.3` | `@meshql-js/core` only |
| Per-package tag | `npm/http/v0.1.3` | `@meshql-js/http` only |
| Umbrella tag | `npm/all/v0.1.3` | core → … → client (see tag list) |
| Manual dispatch | Actions → Publish | selected package(s) / registry |

Each npm tag push creates a **GitHub Release** with `.tgz` assets.

### Local pack (dry run)

```bash
pnpm build
pnpm publish:dry-run
pnpm publish:npm:pack   # writes artifacts/*.tgz for all publishable packages
```

`scripts/prepare-npm-publish.mjs` rewrites `package.json` for publish (`@meshql-js/*` names, `workspace:*` → semver, strip devDeps). Build already rewrites `@meshql/*` imports in `dist/` to `@meshql-js/*`. CI restores manifests after each package.

## Pull requests

- Keep PRs focused - one feature or fix per PR when possible.
- Add a **changeset** (`pnpm changeset`) for user-facing package changes; CI opens a Version Packages PR.
- For small doc-only changes with no release, a changeset is optional.
- Write clear commit messages and PR descriptions explaining **why**, not just what.
- Ensure CI passes.

## Reporting issues

- **Bugs:** include reproduction steps, expected vs actual behavior, and environment (Node version, OS).
- **Features:** describe the use case and how it fits MeshQL's scope (REST + shaped queries, minimal ceremony).

## Code style

- TypeScript strict mode; match existing patterns in the package you're editing.
- Prefer small, focused changes over large refactors unless discussed first.
- Comments only where behavior is non-obvious.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
