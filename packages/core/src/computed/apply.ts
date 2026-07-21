import type { AST, ASTNode } from "../parser/ast.js";
import { joinPathAlias, type JoinPlan } from "../planner/join-plan.js";
import type { MeshSchema } from "../schema/schema.js";
import { entityTable } from "../schema/schema.js";

export type { PlanComputedField } from "./types.js";

function readDepFromFlatRow(
  row: Record<string, unknown>,
  dep: string,
  entityKey: string,
  joinPath: string | undefined,
  schema: MeshSchema,
): unknown {
  if (!dep.includes(".")) {
    if (joinPath) {
      const alias = `${joinPathAlias(joinPath)}_${dep}`;
      if (alias in row) return row[alias];
    } else {
      const table = entityTable(entityKey, schema.entities[entityKey]);
      const tableAlias = `${table}_${dep}`;
      if (tableAlias in row) return row[tableAlias];
      const entityAlias = `${entityKey}_${dep}`;
      if (entityAlias in row) return row[entityAlias];
    }
    return row[dep];
  }

  const [refName, ...rest] = dep.split(".");
  const field = rest.join(".");
  if (!refName || !field) return undefined;

  const childPath = joinPath ? `${joinPath}.${refName}` : refName;
  const alias = `${joinPathAlias(childPath)}_${field}`;
  if (alias in row) return row[alias];
  return undefined;
}

function readDepFromObject(
  obj: Record<string, unknown>,
  dep: string,
): unknown {
  if (!dep.includes(".")) {
    return obj[dep];
  }
  const [refName, ...rest] = dep.split(".");
  const field = rest.join(".");
  if (!refName || !field) return undefined;
  const nested = obj[refName];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return undefined;
  }
  return (nested as Record<string, unknown>)[field];
}

/** Inject computed field aliases into flat resolver rows before shaping. */
export function injectComputedIntoFlatRows(
  rows: Record<string, unknown>[],
  plan: JoinPlan,
  schema: MeshSchema,
): void {
  const computed = plan.computedFields;
  if (!computed || computed.length === 0) return;

  for (const row of rows) {
    for (const entry of computed) {
      const deps: Record<string, unknown> = {};
      for (const dep of entry.def.from) {
        deps[dep] = readDepFromFlatRow(
          row,
          dep,
          entry.entity,
          entry.path || undefined,
          schema,
        );
      }
      const value = entry.def.compute(deps);
      const joinPath = entry.path || undefined;
      if (!joinPath) {
        const table = entityTable(
          plan.rootEntity,
          schema.entities[plan.rootEntity],
        );
        row[`${table}_${entry.name}`] = value;
        row[`${plan.rootEntity}_${entry.name}`] = value;
      } else {
        row[`${joinPathAlias(joinPath)}_${entry.name}`] = value;
      }
    }
  }
}

function applyComputedToObject(
  obj: Record<string, unknown>,
  node: ASTNode,
  entityKey: string,
  joinPath: string,
  plan: JoinPlan,
  schema: MeshSchema,
): void {
  const config = schema.entities[entityKey];
  if (!config) return;

  for (const field of node.fields) {
    const def = config.computed?.[field];
    if (!def) continue;
    const deps: Record<string, unknown> = {};
    for (const dep of def.from) {
      deps[dep] = readDepFromObject(obj, dep);
    }
    obj[field] = def.compute(deps);
  }

  for (const ref of node.refs) {
    const childPath = joinPath ? `${joinPath}.${ref.name}` : ref.name;
    const join = plan.joins.find((j) => j.path === childPath);
    if (!join) continue;
    const child = obj[ref.name];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object") {
          applyComputedToObject(
            item as Record<string, unknown>,
            ref,
            join.entity,
            childPath,
            plan,
            schema,
          );
        }
      }
    } else if (child && typeof child === "object") {
      applyComputedToObject(
        child as Record<string, unknown>,
        ref,
        join.entity,
        childPath,
        plan,
        schema,
      );
    }
  }
}

/** Keep only AST-selected fields/refs (matches flat shaper projection). */
function projectToAst(
  obj: Record<string, unknown>,
  node: ASTNode,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of node.fields) {
    out[field] = obj[field];
  }
  for (const ref of node.refs) {
    const child = obj[ref.name];
    if (Array.isArray(child)) {
      out[ref.name] = child.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? projectToAst(item as Record<string, unknown>, ref)
          : item,
      );
    } else if (child && typeof child === "object") {
      out[ref.name] = projectToAst(child as Record<string, unknown>, ref);
    } else {
      out[ref.name] = child;
    }
  }
  return out;
}

/**
 * Apply computed fields on a preshaped (already nested) response and strip
 * unrequested fields (including source deps and auto-fetched ids).
 */
export function applyComputedToPreshaped(
  data: Record<string, unknown> | Record<string, unknown>[],
  ast: AST,
  plan: JoinPlan,
  schema: MeshSchema,
): Record<string, unknown> | Record<string, unknown>[] {
  if (!plan.computedFields || plan.computedFields.length === 0) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => {
      applyComputedToObject(item, ast.root, plan.rootEntity, "", plan, schema);
      return projectToAst(item, ast.root);
    });
  }

  applyComputedToObject(data, ast.root, plan.rootEntity, "", plan, schema);
  return projectToAst(data, ast.root);
}
