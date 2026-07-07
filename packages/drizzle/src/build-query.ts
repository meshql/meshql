import type {
  JoinPlan,
  MeshSchema,
  OrmFilter,
  RelationNode,
} from "@meshql/core";
import {
  buildOrmListQuery,
  buildOrmPointRead,
  buildPlanRelationTree,
  mapEntityField,
  entityTable,
} from "@meshql/core";

export type DrizzleColumns = Record<string, boolean>;
export type DrizzleWith = Record<string, DrizzleRelationQuery>;
export interface DrizzleRelationQuery {
  columns?: DrizzleColumns;
  with?: DrizzleWith;
}

function toDrizzleRelation(
  node: RelationNode,
  schema: MeshSchema,
): DrizzleRelationQuery {
  const columns: DrizzleColumns = {};
  for (const field of node.scalars) {
    columns[mapEntityField(node.entity, field, schema)] = true;
  }

  const withClause: DrizzleWith = {};
  for (const child of node.children) {
    withClause[child.refName] = toDrizzleRelation(child, schema);
  }

  return {
    columns,
    ...(Object.keys(withClause).length > 0 ? { with: withClause } : {}),
  };
}

/** Build Drizzle relational `columns` + `with` from a join plan. */
export function buildDrizzleQuery(
  plan: JoinPlan,
  schema: MeshSchema,
): { columns: DrizzleColumns; with?: DrizzleWith } {
  const tree = buildPlanRelationTree(plan, schema);
  const columns: DrizzleColumns = {};

  for (const field of tree.scalars) {
    columns[mapEntityField(tree.rootEntity, field, schema)] = true;
  }

  const withClause: DrizzleWith = {};
  for (const relation of tree.relations) {
    withClause[relation.refName] = toDrizzleRelation(relation, schema);
  }

  return {
    columns,
    ...(Object.keys(withClause).length > 0 ? { with: withClause } : {}),
  };
}

function filterToDrizzle(
  filter: OrmFilter,
  entity: string,
  schema: MeshSchema,
): Record<string, unknown> {
  const field = mapEntityField(entity, filter.field, schema);

  switch (filter.op) {
    case "eq":
      return { [field]: filter.value };
    case "ne":
      return { [field]: { ne: filter.value } };
    case "gt":
      return { [field]: { gt: filter.value } };
    case "gte":
      return { [field]: { gte: filter.value } };
    case "lt":
      return { [field]: { lt: filter.value } };
    case "lte":
      return { [field]: { lte: filter.value } };
    case "in":
      return { [field]: { in: filter.value } };
    case "nin":
      return { [field]: { notIn: filter.value } };
    case "like":
      return { [field]: { like: `%${filter.value}%` } };
    case "ilike":
      return { [field]: { ilike: `%${filter.value}%` } };
  }
}

/** Build Drizzle relational `where` from list filters or point reads. */
export function buildDrizzleWhere(
  plan: JoinPlan,
  schema: MeshSchema,
): Record<string, unknown> | undefined {
  const point = buildOrmPointRead(plan, schema);
  if (point) {
    return { [point.idField]: coerceId(point.idValue) };
  }

  const list = buildOrmListQuery(plan);
  if (!list || list.filters.length === 0) {
    return undefined;
  }

  return {
    and: list.filters.map((filter) =>
      filterToDrizzle(filter, plan.rootEntity, schema),
    ),
  };
}

function buildDrizzleOrderBy(
  plan: JoinPlan,
  schema: MeshSchema,
): Record<string, "asc" | "desc">[] | undefined {
  const list = buildOrmListQuery(plan);
  if (!list || list.orderBy.length === 0) {
    return undefined;
  }

  return list.orderBy.map((entry) => ({
    [mapEntityField(plan.rootEntity, entry.field, schema)]: entry.dir,
  }));
}

export interface DrizzleListArgs {
  limit: number;
  offset?: number;
  where?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc">[];
}

/** Build Drizzle relational list-read arguments. */
export function buildDrizzleListArgs(
  plan: JoinPlan,
  schema: MeshSchema,
): DrizzleListArgs | undefined {
  const list = buildOrmListQuery(plan);
  if (!list) {
    return undefined;
  }

  const args: DrizzleListArgs = {
    limit: list.limit,
    where: buildDrizzleWhere(plan, schema),
    orderBy: buildDrizzleOrderBy(plan, schema),
  };

  // Drizzle has no native opaque cursor — approximate keyset with offset 1
  // when a cursor is present (same semantics as skip: 1 after cursor row).
  if (list.cursorId !== undefined) {
    args.offset = 1;
  }

  return args;
}

/** Resolve the Drizzle `db.query` key for a MeshQL entity. */
export function drizzleQueryKey(entity: string, schema: MeshSchema): string {
  return entityTable(entity, schema.entities[entity]);
}

function coerceId(value: unknown): unknown {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}
