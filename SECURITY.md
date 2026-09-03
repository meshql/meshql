# Security Policy

## Supported versions

The **latest published version** of each package is supported:

- npm: [`@meshqljs/*`](https://www.npmjs.com/org/meshqljs)
- JSR: [`@meshql/*`](https://jsr.io/@meshql)

`@meshql/core` / `@meshqljs/core` **0.11.x** is the current engine line. Older 0.x lines get security fixes only when a backport is practical.

| Line | Supported |
| ---- | --------- |
| Latest published per package | Yes |
| `@meshql/core` 0.11.x | Yes |
| Earlier 0.x | Best-effort |

See the [threat model](./docs/threat-model.md) for what integrity does and does not cover (including query replay until token expiry).

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security issue, report it privately:

1. Open a [GitHub Security Advisory](https://github.com/meshql/meshql/security/advisories/new) (preferred), or
2. Email **security@meshql.dev** with a description, reproduction steps, and impact assessment.

We aim to acknowledge reports within **48 hours** and will work with you on a fix and coordinated disclosure timeline.

## Scope

Security reports are welcome for:

- All published `@meshql/*` / `@meshqljs/*` packages (core, http, client, integrity, access, upload, docs, adapters, …)
- Query parsing, validation, HMAC/token handling, access stripping, and transport headers
- Example applications in `examples/` when they demonstrate a MeshQL flaw (not app-specific misconfig)

Out of scope: third-party dependencies (report to upstream), social engineering, denial-of-service without a concrete flaw in MeshQL itself, and issues that only appear when `auth: false` or `sql: "dev"` is left on a public playground.

## Safe harbor

We support good-faith security research. We will not pursue legal action against researchers who follow this policy and avoid privacy violations, data destruction, or service disruption.
