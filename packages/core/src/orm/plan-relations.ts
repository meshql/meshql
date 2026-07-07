import type { OrderBy } from "../planner/list-options.js";
import { DEFAULT_LIST_LIMIT } from "../planner/list-options.js";
import { decodeCursor } from "../planner/cursor.js";
import {
  parseQualifiedPlanField,
  type JoinPlan,
  type ResolvedJoin,
} from "../planner/join-plan.js";
import {
  entityIdField,
  entityTable,
  type MeshSchema,
} from "../schema/schema.js";

/** Nested relation subtree derived from a {@link JoinPlan}. */
export interface RelationNode {
  path: string;
  refName: string;
  entity: string;
  type: "one" | "many";
  scalars: string[];
  children: RelationNode[];
}

/** Root scalar fields and nested relations for an ORM select/with tree. */
export interface PlanRelationTree {
  rootEntity: string;
  scalars: string[];
  relations: RelationNode[];
}

/** Map a MeshQL field name to the storage/ORM column name. */
export function mapEntityField(
  entity: string,
  field: string,
  schema: MeshSchema,
): string {
  return schema.entities[entity]?.columns?.[field] ?? field;
}

function childJoins(joins: ResolvedJoin[], parentPath: string): ResolvedJoin[] {
  if (!parentPath) {
    return joins.filter((join) => !join.path.includes("."));
  }
  const prefix = `${parentPath}.`;
  return joins.filter((join) => {
    if (!join.path.startsWith(prefix)) {
      return false;
    }
    const rest = join.path.slice(prefix.length);
    return !rest.includes(".");
  });
}

function scalarFieldsForJoin(join: ResolvedJoin): string[] {
  const fields = new Set<string>();
  for (const qualified of join.fields) {
    const prefix = `${join.path}.`;
    if (!qualified.startsWith(prefix)) {
      continue;
    }
    fields.add(qualified.slice(prefix.length));
  }
  return [...fields];
}

function toRelationNode(
  join: ResolvedJoin,
  joins: ResolvedJoin[],
): RelationNode {
  return {
    path: join.path,
    refName: join.refName,
    entity: join.entity,
    type: join.type,
    scalars: scalarFieldsForJoin(join),
    children: childJoins(joins, join.path).map((child) =>
      toRelationNode(child, joins),
    ),
  };
}

/** Build a nested relation tree from a join plan and MeshQL schema. */
export function buildPlanRelationTree(
  plan: JoinPlan,
  schema: MeshSchema,
): PlanRelationTree {
  const joinPaths = plan.joins.map((join) => join.path);
  const rootPrefix = entityTable(
    plan.rootEntity,
    schema.entities[plan.rootEntity],
  );
  const scalars = new Set<string>();

  for (const qualified of plan.fields) {
    const parsed = parseQualifiedPlanField(
      qualified,
      plan.rootEntity,
      joinPaths,
    );
    if (!parsed.joinPath && qualified.startsWith(`${rootPrefix}.`)) {
      scalars.add(parsed.column);
    } else if (!parsed.joinPath) {
      scalars.add(parsed.column);
    }
  }

  return {
    rootEntity: plan.rootEntity,
    scalars: [...scalars],
    relations: childJoins(plan.joins, "").map((join) =>
      toRelationNode(join, plan.joins),
    ),
  };
}

/** List filter mapped to a plain object shape ORM adapters can translate. */
export type OrmFilter =
  | { field: string; op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; value: unknown }
  | { field: string; op: "in" | "nin"; value: unknown[] }
  | { field: string; op: "like" | "ilike"; value: string };

export interface OrmListQuery {
  limit: number;
  filters: OrmFilter[];
  orderBy: OrderBy[];
  cursorId?: unknown;
}

/** Normalize list-read options from a join plan. */
export function buildOrmListQuery(plan: JoinPlan): OrmListQuery | undefined {
  if (plan.context.entityId !== undefined) {
    return undefined;
  }
  if (!plan.list) {
    return undefined;
  }

  const filters: OrmFilter[] = (plan.list.filter ?? []).map((filter) => {
    if (filter.op === "in" || filter.op === "nin") {
      return {
        field: filter.field,
        op: filter.op,
        value: Array.isArray(filter.value) ? filter.value : [filter.value],
      };
    }
    if (filter.op === "like" || filter.op === "ilike") {
      return {
        field: filter.field,
        op: filter.op,
        value: String(filter.value),
      };
    }
    return {
      field: filter.field,
      op: filter.op,
      value: filter.value,
    };
  });

  return {
    limit: plan.list.limit ?? DEFAULT_LIST_LIMIT,
    filters,
    orderBy: plan.list.orderBy ?? [],
    cursorId: plan.list.cursor ? decodeCursor(plan.list.cursor).id : undefined,
  };
}

/** Point-read primary key lookup for an entity. */
export function buildOrmPointRead(
  plan: JoinPlan,
  schema: MeshSchema,
): { idField: string; idValue: unknown } | undefined {
  if (plan.context.entityId === undefined) {
    return undefined;
  }
  const config = schema.entities[plan.rootEntity];
  const idField = mapEntityField(
    plan.rootEntity,
    entityIdField(config),
    schema,
  );
  return { idField, idValue: plan.context.entityId };
}
