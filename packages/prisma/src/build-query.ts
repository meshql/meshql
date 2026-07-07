import type {
  JoinPlan,
  MeshSchema,
  OrmFilter,
  OrmListQuery,
  RelationNode,
} from "@meshql/core";
import {
  buildOrmListQuery,
  buildOrmPointRead,
  buildPlanRelationTree,
  mapEntityField,
} from "@meshql/core";

export type PrismaSelect = Record<string, boolean | PrismaSelectObject>;
export type PrismaSelectObject = { select: PrismaSelect };
export type PrismaWhere = Record<string, unknown>;
export type PrismaOrderBy = Record<string, "asc" | "desc"> | PrismaOrderBy[];

function toPrismaSelect(
  node: RelationNode,
  schema: MeshSchema,
): PrismaSelect {
  const select: PrismaSelect = {};
  for (const field of node.scalars) {
    select[mapEntityField(node.entity, field, schema)] = true;
  }
  for (const child of node.children) {
    select[child.refName] = { select: toPrismaSelect(child, schema) };
  }
  return select;
}

/** Build a Prisma `select` object from a MeshQL join plan. */
export function buildPrismaSelect(
  plan: JoinPlan,
  schema: MeshSchema,
): PrismaSelect {
  const tree = buildPlanRelationTree(plan, schema);
  const select: PrismaSelect = {};

  for (const field of tree.scalars) {
    select[mapEntityField(tree.rootEntity, field, schema)] = true;
  }
  for (const relation of tree.relations) {
    select[relation.refName] = { select: toPrismaSelect(relation, schema) };
  }

  return select;
}

function filterToPrismaWhere(
  filter: OrmFilter,
  entity: string,
  schema: MeshSchema,
): PrismaWhere {
  const field = mapEntityField(entity, filter.field, schema);

  switch (filter.op) {
    case "eq":
      return { [field]: filter.value };
    case "ne":
      return { [field]: { not: filter.value } };
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
      return { [field]: { contains: filter.value } };
    case "ilike":
      return { [field]: { contains: filter.value, mode: "insensitive" } };
  }
}

/** Build a Prisma `where` clause from a join plan. */
export function buildPrismaWhere(
  plan: JoinPlan,
  schema: MeshSchema,
): PrismaWhere | undefined {
  const point = buildOrmPointRead(plan, schema);
  if (point) {
    return { [point.idField]: coerceId(point.idValue) };
  }

  const list = buildOrmListQuery(plan);
  if (!list || list.filters.length === 0) {
    return undefined;
  }

  return {
    AND: list.filters.map((filter) =>
      filterToPrismaWhere(filter, plan.rootEntity, schema),
    ),
  };
}

/** Build Prisma `orderBy` from list options on a join plan. */
export function buildPrismaOrderBy(
  plan: JoinPlan,
  schema: MeshSchema,
): PrismaOrderBy | undefined {
  const list = buildOrmListQuery(plan);
  if (!list || list.orderBy.length === 0) {
    return undefined;
  }

  const entries = list.orderBy.map((entry) => ({
    [mapEntityField(plan.rootEntity, entry.field, schema)]: entry.dir,
  }));

  return entries.length === 1 ? entries[0]! : entries;
}

export interface PrismaListArgs {
  take: number;
  skip?: number;
  cursor?: PrismaWhere;
  orderBy?: PrismaOrderBy;
  where?: PrismaWhere;
}

/** Build Prisma list-read arguments (`take`, `cursor`, `orderBy`, `where`). */
export function buildPrismaListArgs(
  plan: JoinPlan,
  schema: MeshSchema,
): PrismaListArgs {
  const list = buildOrmListQuery(plan);
  const where = buildPrismaWhere(plan, schema);
  const orderBy = buildPrismaOrderBy(plan, schema);

  if (!list) {
    return { take: 50, where, orderBy };
  }

  const args: PrismaListArgs = {
    take: list.limit,
    where,
    orderBy,
  };

  if (list.cursorId !== undefined) {
    const idField = mapEntityField(
      plan.rootEntity,
      plan.idField,
      schema,
    );
    args.cursor = { [idField]: coerceId(list.cursorId) };
    args.skip = 1;
  }

  return args;
}

function coerceId(value: unknown): unknown {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}
