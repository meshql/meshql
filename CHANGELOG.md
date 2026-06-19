# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Per-package changelogs** (used by Changesets for releases) live under `packages/*/CHANGELOG.md`.

## [Unreleased]

## [0.1.2] - 2026-06-18

### Added

- Per-package `README.md` files with usage examples for JSR documentation score
- Module-level JSDoc (`@module`, `@example`) on all JSR entrypoints
- JSDoc on exported public APIs across all publishable packages
- `docs/jsr-settings.md` with JSR description and runtime compatibility checklist

## [0.1.1] - 2026-06-18

### Added

- `@meshql/core` - parser, planner, shaper, `createMesh()`, `buildSelectSql()`
- `@meshql/http` - header transport, Express / Fastify / Hono adapters
- `@meshql/client` - typed client SDK with automatic query encoding
- `@meshql/upload` - opt-in file upload extension
- `examples/express-postgres` - end-to-end demo with in-memory and Postgres modes

### Fixed

- JSR publish rewrites `workspace:*` deps to `jsr:` specifiers in CI before publish
