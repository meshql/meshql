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
| `packages/plugins` | Optional plugins (peer on core) |
| `examples/` | Runnable examples |
| `docs/` | Usage guides |

HTTP setup: [docs/http-adapters.md](./docs/http-adapters.md).

## Releasing packages

MeshQL is a **pnpm + Turbo monorepo** with **independent per-package versions**. Each library can ship on its own schedule. npm and JSR share the same semver per package (`package.json` is the source of truth; `jsr.json` is synced automatically).

### Publishable packages

| Package | npm name | JSR name |
| --- | --- | --- |
| `@meshql/core` | `meshql-core` | `@meshql/core` |
| `@meshql/http` | `meshql-http` | `@meshql/http` |
| `@meshql/client` | `meshql-client` | `@meshql/client` |
| `@meshql/upload` | `meshql-upload` | `@meshql/upload` |
| `@meshql/integrity` | `meshql-integrity` | `@meshql/integrity` |
| `@meshql/access` | `meshql-access` | `@meshql/access` |
| `@meshql/plugins` | `meshql-plugins` | `@meshql/plugins` |

`@meshql/typescript-config` is private and never published.

**Publish order** (when multiple packages release together): `core → http → upload → client → integrity → access → plugins`.

### Standard release flow (Changesets)

1. **Add a changeset** in your feature PR when you ship user-facing changes:

```bash
pnpm changeset
```

Choose the affected package(s) and semver bump (patch / minor / major). This creates a file under `.changeset/`.

2. **Merge your PR** to `main`. If changesets are pending, CI opens or updates a **Version Packages** PR ([`.github/workflows/release.yml`](./.github/workflows/release.yml)).

3. **Merge the Version Packages PR.** It bumps `package.json`, syncs `jsr.json`, and updates per-package `CHANGELOG.md` files.

4. **CI creates per-package tags** on `main` and existing publish workflows run:
   - npm: `npm/{pkg}/v{version}` → [publish-npm.yml](./.github/workflows/publish-npm.yml)
   - JSR: `{pkg}/v{version}` → [publish-jsr.yml](./.github/workflows/publish-jsr.yml)

Example: releasing only `@meshql/core` at `0.1.4` pushes `npm/core/v0.1.4` and `core/v0.1.4` — no umbrella tag required.

### Manual release (fallback)

Bump `version` in `packages/{pkg}/package.json`, run `node scripts/sync-jsr-versions.mjs`, update the package `CHANGELOG.md`, commit, then:

```bash
git tag npm/core/v0.1.4
git tag core/v0.1.4
git push origin npm/core/v0.1.4 core/v0.1.4
```

Or use **Actions → Publish npm / Publish JSR → Run workflow** to retry a single package without retagging.

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

**Setup checklist:**

| Package | JSR created | GitHub linked |
| --- | --- | --- |
| `@meshql/core` | yes | yes |
| `@meshql/http` | yes | yes |
| `@meshql/client` | yes | yes |
| `@meshql/upload` | yes | yes |
| `@meshql/integrity` | **required before first tag** | **required before first tag** |
| `@meshql/access` | **required before first tag** | **required before first tag** |
| `@meshql/plugins` | **required before first tag** | **required before first tag** |

Without linking, CI fails with `actorNotAuthorized`. See [docs/jsr-settings.md](./docs/jsr-settings.md) for descriptions and runtime compatibility.

### Local JSR publish

```bash
pnpm build
pnpm publish:jsr   # all publishable packages, in workspace order
```

Dry run: `cd packages/core && npx jsr publish --dry-run`.

Already-published versions are skipped automatically by `jsr publish`.

## Publishing to npm (interim)

Until the `@meshql` org is available on [npmjs.com](https://www.npmjs.com), packages publish as **unscoped** `meshql-*` names with compiled `dist/` (ESM). JSR remains the source for `@meshql/*` TypeScript packages.

### One-time npm setup

1. Create an [npm access token](https://www.npmjs.com/settings/~/tokens) with **Automation** or **Publish** scope.
2. Add it to the GitHub repo:

```bash
gh secret set NPM_TOKEN --repo meshql/meshql
```

3. Ensure each `meshql-*` package name is available on npm (first publish claims the name).

### npm tag reference

| Trigger | Example | Publishes |
| --- | --- | --- |
| Per-package tag | `npm/core/v0.1.3` | `meshql-core` only |
| Per-package tag | `npm/http/v0.1.3` | `meshql-http` only |
| Umbrella tag | `npm/all/v0.1.3` | core → http → upload → client |
| Manual dispatch | Actions → Publish npm | selected package(s) |

Each tag push creates a **GitHub Release** with `.tgz` assets:

```bash
npm install https://github.com/meshql/meshql/releases/download/npm/core/v0.1.3/meshql-core-0.1.3.tgz
```

### Local pack (dry run)

```bash
pnpm build
pnpm publish:npm:pack   # writes artifacts/*.tgz for all seven packages
```

`scripts/prepare-npm-publish.mjs` rewrites `package.json` for publish (rename, `workspace:*` → semver, strip devDeps). CI restores manifests after each package.

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
