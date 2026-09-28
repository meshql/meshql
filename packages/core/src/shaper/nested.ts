import type { ASTNode } from "../parser/ast.js";
import type { JoinPlan } from "../planner/join-plan.js";
import { groupKeyAlias } from "../query/group-keys.js";
import { GROUP_ITEMS_KEY, type NormalizedReadNode } from "../query/types.js";
import type { MeshSchema } from "../schema/schema.js";

type Row = Record<string, unknown>;

/** SQLite returns JSON columns as text; Postgres drivers usually parse them. */
function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isRow(value: unknown): value is Row {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readDep(obj: Row, dep: string): unknown {
  if (!dep.includes(".")) return obj[dep];
  const [refName, ...rest] = dep.split(".");
  const nested = obj[refName!];
  return isRow(nested) ? nested[rest.join(".")] : undefined;
}

class NestedShaper {
  constructor(
    private readonly plan: JoinPlan,
    private readonly schema: MeshSchema,
  ) {}

  shapeRecord(
    obj: Row,
    node: ASTNode,
    read: NormalizedReadNode | undefined,
    entityKey: string,
    path: string,
  ): Row {
    for (const join of this.plan.joins) {
      if (join.path === (path ? `${path}.${join.refName}` : join.refName)) {
        obj[join.refName] = parseJsonValue(obj[join.refName]);
      }
    }

    const config = this.schema.entities[entityKey];
    const out: Row = {};
    for (const field of node.fields) {
      const def = config?.computed?.[field];
      if (def) {
        const deps: Row = {};
        for (const dep of def.from) deps[dep] = readDep(obj, dep);
        out[field] = def.compute(deps);
      } else {
        out[field] = obj[field];
      }
    }

    for (const ref of node.refs) {
      const childPath = path ? `${path}.${ref.name}` : ref.name;
      const join = this.plan.joins.find((candidate) => candidate.path === childPath);
      const childRead = read?.refs.find((candidate) => candidate.name === ref.name);
      const value = obj[ref.name];
      if (!join) {
        out[ref.name] = value;
        continue;
      }
      if (join.type === "one") {
        out[ref.name] = isRow(value)
          ? this.shapeRecord(value, ref, childRead, join.entity, childPath)
          : null;
        continue;
      }
      const list = Array.isArray(value) ? value : [];
      out[ref.name] = childRead?.groupBy?.length
        ? list.filter(isRow).map((bucket) =>
            this.shapeBucket(bucket, ref, childRead, join.entity, childPath),
          )
        : list
            .filter(isRow)
            .map((item) => this.shapeRecord(item, ref, childRead, join.entity, childPath));
    }
    return out;
  }

  private shapeBucket(
    bucket: Row,
    node: ASTNode,
    read: NormalizedReadNode,
    entityKey: string,
    path: string,
  ): Row {
    const out: Row = {};
    for (const key of read.groupBy ?? []) {
      const name = groupKeyAlias(key);
      out[name] = bucket[name];
    }
    for (const name of Object.keys(read.aggregates ?? {})) {
      out[name] = bucket[name];
    }
    const items = parseJsonValue(bucket[GROUP_ITEMS_KEY]);
    out[GROUP_ITEMS_KEY] = (Array.isArray(items) ? items : [])
      .filter(isRow)
      .map((item) => this.shapeRecord(item, node, read, entityKey, path));
    return out;
  }
}

/**
 * Shape rows produced by the nested fetch strategy: parse per-relation JSON
 * columns, evaluate computed fields and project to the selection. Grouped
 * `many` relations become `[{ <group keys>, <aggregates>, items: [...] }]`.
 */
export function shapeNested(
  rows: Row[],
  root: ASTNode,
  plan: JoinPlan,
  schema: MeshSchema,
): Row[] {
  const shaper = new NestedShaper(plan, schema);
  return rows.map((row) =>
    shaper.shapeRecord({ ...row }, root, plan.read, plan.rootEntity, ""),
  );
}
