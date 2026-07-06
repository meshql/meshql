import type { JoinPlan, ResolvedJoin } from "./join-plan.js";
import {
  joinPathAlias,
  parseQualifiedPlanField,
} from "./join-plan.js";
import type { MeshSchema } from "../schema/schema.js";
import { entityTable } from "../schema/schema.js";

/** Physical SQL table for a resolved join. */
export function physicalTableForJoin(
  join: ResolvedJoin,
  schema: MeshSchema,
): string {
  const joinConfig = schema.joins[join.joinKey];
  return (
    joinConfig?.table ??
    entityTable(join.entity, schema.entities[join.entity])
  );
}

/** SQL table alias for a join path (unique even when the same table joins twice). */
export function sqlAliasForJoinPath(path: string): string {
  return joinPathAlias(path);
}

/** Row alias emitted in SELECT AS for a plan field. */
export function rowAliasForPlanField(
  qualified: string,
  plan: JoinPlan,
): string {
  const joinPaths = plan.joins.map((join) => join.path);
  const parsed = parseQualifiedPlanField(qualified, plan.rootEntity, joinPaths);
  if (!parsed.joinPath) {
    return `${plan.rootEntity}_${parsed.column}`;
  }
  return `${sqlAliasForJoinPath(parsed.joinPath)}_${parsed.column}`;
}

/** Joins ordered shallowest-first so parent tables exist before children. */
export function joinsInDependencyOrder(joins: ResolvedJoin[]): ResolvedJoin[] {
  return [...joins].sort(
    (a, b) => a.path.split(".").length - b.path.split(".").length,
  );
}

function replaceWord(haystack: string, word: string, replacement: string): string {
  return haystack.replace(new RegExp(`\\b${word}\\b`, "g"), replacement);
}

/** Rewrite a schema ON clause to use SQL aliases for parent joins and self. */
export function rewriteJoinOn(
  on: string,
  join: ResolvedJoin,
  joins: ResolvedJoin[],
  pathToAlias: Map<string, string>,
  schema: MeshSchema,
): string {
  let result = on;
  const selfTable = physicalTableForJoin(join, schema);
  const selfAlias = pathToAlias.get(join.path)!;
  result = replaceWord(result, selfTable, selfAlias);

  const parts = join.path.split(".");
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join(".");
    const parentJoin = joins.find((candidate) => candidate.path === parentPath);
    if (!parentJoin) {
      continue;
    }
    const parentTable = physicalTableForJoin(parentJoin, schema);
    const parentAlias = pathToAlias.get(parentPath)!;
    result = replaceWord(result, parentTable, parentAlias);
  }

  return result;
}

/** Build path → SQL alias map for all joins in a plan. */
export function buildPathToSqlAlias(plan: JoinPlan): Map<string, string> {
  const map = new Map<string, string>();
  for (const join of plan.joins) {
    map.set(join.path, sqlAliasForJoinPath(join.path));
  }
  return map;
}

/** Resolve entity key and SQL column for a qualified plan field. */
export function resolvePlanField(
  qualified: string,
  plan: JoinPlan,
  schema: MeshSchema,
  rootTable: string,
): { sqlTableRef: string; sqlColumn: string; entityKey: string } {
  const joinPaths = plan.joins.map((join) => join.path);
  const parsed = parseQualifiedPlanField(qualified, plan.rootEntity, joinPaths);
  const pathToAlias = buildPathToSqlAlias(plan);

  if (!parsed.joinPath) {
    const rootConfig = schema.entities[plan.rootEntity];
    const column = rootConfig?.columns?.[parsed.column] ?? parsed.column;
    return {
      sqlTableRef: rootTable,
      sqlColumn: column,
      entityKey: plan.rootEntity,
    };
  }

  const join = plan.joins.find((candidate) => candidate.path === parsed.joinPath);
  if (!join) {
    return {
      sqlTableRef: parsed.joinPath,
      sqlColumn: parsed.column,
      entityKey: parsed.joinPath,
    };
  }

  const entityKey = join.entity;
  const entityConfig = schema.entities[entityKey];
  const column = entityConfig?.columns?.[parsed.column] ?? parsed.column;
  return {
    sqlTableRef: pathToAlias.get(join.path)!,
    sqlColumn: column,
    entityKey,
  };
}
