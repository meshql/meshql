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
| `examples/` | Runnable examples |
| `docs/` | Usage guides |

HTTP setup: [docs/http-adapters.md](./docs/http-adapters.md).

## Publishing to JSR

Packages: `@meshql/core`, `@meshql/http`, `@meshql/client`, `@meshql/upload` at `0.1.0`.

### One-time JSR setup (required for each package)

JSR OIDC only works for packages **linked to your GitHub repo**. Creating `@meshql/core` is not enough.

For **each** package:

1. Go to [jsr.io/new](https://jsr.io/new) and create it under the `@meshql` scope (if not created yet).
2. Open the package on JSR → **Settings** → **GitHub repository**.
3. Enter `meshql/meshql` and click **Link**.

Do this for `http`, `client`, and `upload` even if `core` already published. Without linking, CI fails with `actorNotAuthorized`.

### Internal dependencies

Published packages declare JSR deps in `package.json` (e.g. `"@meshql/core": "jsr:@meshql/core@^0.1.0"`). `@meshql/client` still uses `workspace:*` for `@meshql/http` until that package is on JSR; switch it to `jsr:@meshql/http@^0.1.0` after the first successful `http` publish.

### Manual publish

1. Commit all changes (`jsr publish` rejects dirty git trees).
2. Publish in order:

```bash
cd packages/core && npx jsr publish
cd ../http && npx jsr publish
cd ../upload && npx jsr publish
cd ../client && npx jsr publish
```

Or from root: `pnpm publish:jsr`

`@meshql/core` at `0.1.0` skips re-publish if already live. Dry run: `npx jsr publish --dry-run`.

### CI

Use **per-package tags** for independent releases, an **umbrella tag** to ship everything, or **workflow dispatch** to retry one package.

| Trigger | Example | Publishes |
| --- | --- | --- |
| Per-package tag | `core/v0.1.0` | `@meshql/core` only |
| Per-package tag | `http/v0.1.0` | `@meshql/http` only |
| Umbrella tag | `all/v0.1.0` | all four packages, in order |
| Legacy umbrella | `v0.1.0` | all four packages, in order |
| Manual dispatch | Actions → Publish JSR → choose package | selected package(s) |

Bump `version` in the package's `jsr.json` before tagging. Tag version must match `jsr.json` (CI checks this).

```bash
# Publish only core
git tag core/v0.1.0
git push origin core/v0.1.0

# Publish only http (after core is live and linked on JSR)
git tag http/v0.1.0
git push origin http/v0.1.0

# Publish everything
git tag all/v0.1.0
git push origin all/v0.1.0
```

To retry a failed package without retagging, open **Actions → Publish JSR → Run workflow** and pick `http`, `upload`, or `client`.

Already-published versions are skipped automatically by `jsr publish`.

## Pull requests

- Keep PRs focused - one feature or fix per PR when possible.
- Update [CHANGELOG.md](./CHANGELOG.md) under `[Unreleased]` for user-facing changes.
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
