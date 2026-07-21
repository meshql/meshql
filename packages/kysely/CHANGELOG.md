# @meshql/kysely

## 0.6.3

### Patch Changes

- 9687686: Ship `@meshql/docs` interactive playground (schema introspection, execute proxy, SQL trace) and core `executeDetailed` / plan + SQL trace hooks for 0.10.0.
- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
  - @meshql/core@0.8.0
  - @meshql/postgres@0.6.0
  - @meshql/sqlite@0.6.0

## 0.6.2

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.1
  - @meshql/postgres@0.5.4
  - @meshql/sqlite@0.5.4

## 0.6.1

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.0
  - @meshql/postgres@0.5.3
  - @meshql/sqlite@0.5.3

## 0.6.0

### Minor Changes

- v0.6.0: ORM adapters (Prisma, Drizzle, Kysely) and core support for preshaped resolvers, ORM plan-relation helpers, and cursor exports. Includes `examples/express-prisma` and ORM documentation.

### Patch Changes

- Updated dependencies
  - @meshql/core@0.6.0
  - @meshql/postgres@0.5.2
  - @meshql/sqlite@0.5.2

## 0.6.0

### Minor Changes

- Initial release: `kyselyResolver`, `withKysely` — executes join plans via `executeQuery` using `@meshql/postgres` or `@meshql/sqlite` SQL builders.
