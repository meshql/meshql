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

### Manual (first time)

1. Link the repo on [jsr.io](https://jsr.io) to `meshql/meshql` (OIDC for CI, or login locally).
2. Commit all changes (`jsr publish` rejects dirty git trees).
3. Publish in order:

```bash
cd packages/core && npx jsr publish
cd ../http && npx jsr publish
cd ../upload && npx jsr publish
cd ../client && npx jsr publish
```

Or from root: `pnpm publish:jsr`

Dry run first: `npx jsr publish --dry-run` (add `--allow-dirty` only to test uncommitted work).

### CI (after linking)

Push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/publish-jsr.yml` runs build, test, then publishes all four packages via OIDC (no `JSR_TOKEN` secret needed when the repo is linked).

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
