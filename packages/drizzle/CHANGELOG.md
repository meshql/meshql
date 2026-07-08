# @meshql/drizzle

## 0.7.0

### Minor Changes

- v0.7.0: schema inference from ORMs — `extendSchema` in core, `schemaFromPrisma` / `schemaFromPrismaSource`, and `schemaFromDrizzle`. Express-prisma demo now infers its MeshSchema from `schema.prisma`.

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.0

## 0.6.0

### Minor Changes

- v0.6.0: ORM adapters (Prisma, Drizzle, Kysely) and core support for preshaped resolvers, ORM plan-relation helpers, and cursor exports. Includes `examples/express-prisma` and ORM documentation.

### Patch Changes

- Updated dependencies
  - @meshql/core@0.6.0

## 0.6.0

### Minor Changes

- Initial release: `drizzleResolver`, `withDrizzle`, and Drizzle relational `with` query builders from JoinPlan.
