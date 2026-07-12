# meshql-codemods

GraphQL SDL → MeshQL schema migration (v0.9.0 P1).

## Install

```bash
npm install meshql-codemods
# or
npx jsr add @meshql/codemods
```

## CLI

```bash
npx meshql-codemod graphql-sdl ./schema.graphql --out ./meshql-migration
```

Outputs `schema.ts`, `resolvers.ts`, and `migration-report.json`.

## Programmatic

```ts
import { migrateGraphqlSdl } from "@meshql/codemods";

const { schema, schemaSource, report, resolverStubs } = migrateGraphqlSdl(sdl);
```

See [From GraphQL](https://docs.meshql.dev/guide/from-graphql) for the full migration guide.
