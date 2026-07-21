import { createHash } from "node:crypto";
import { ValidationError } from "../errors/index.js";
import type { AST, ASTNode } from "../parser/ast.js";
import {
  entityIdField,
  entityQueryableFields,
  isComputedField,
  resolveEntityKey,
  type MeshSchema,
} from "../schema/schema.js";
import type { ReadNodeWire } from "./types.js";
import {
  DEFAULT_PAGE_FIRST,
  MAX_AGGREGATES,
  MAX_FILTER_DEPTH,
  MAX_FILTER_NODES,
  MAX_GROUP_KEYS,
  MAX_IN_SIZE,
  MAX_PAGE_FIRST,
  type NormalizedReadNode,
  type SortExpr,
  type WhereExpr,
} from "./types.js";

function countWhereNodes(expr: WhereExpr, depth = 1): { depth: number; count: number } {
  let maxDepth = depth;
  let count = 1;
  if ("and" in expr) {
    for (const child of expr.and) {
      const sub = countWhereNodes(child, depth + 1);
      maxDepth = Math.max(maxDepth, sub.depth);
      count += sub.count;
    }
  } else if ("or" in expr) {
    for (const child of expr.or) {
      const sub = countWhereNodes(child, depth + 1);
      maxDepth = Math.max(maxDepth, sub.depth);
      count += sub.count;
    }
  } else if ("not" in expr) {
    const sub = countWhereNodes(expr.not, depth + 1);
    maxDepth = Math.max(maxDepth, sub.depth);
    count += sub.count;
  } else if (expr.op === "in" || expr.op === "nin") {
    if (Array.isArray(expr.value) && expr.value.length > MAX_IN_SIZE) {
      throw new ValidationError(`'in' array exceeds maximum of ${MAX_IN_SIZE}`);
    }
  }
  return { depth: maxDepth, count };
}

function validateWhere(expr: WhereExpr | undefined, entityKey: string, schema: MeshSchema): void {
  if (!expr) return;
  const { depth, count } = countWhereNodes(expr);
  if (depth > MAX_FILTER_DEPTH) {
    throw new ValidationError(`Filter tree exceeds max depth of ${MAX_FILTER_DEPTH}`);
  }
  if (count > MAX_FILTER_NODES) {
    throw new ValidationError(`Filter tree exceeds max nodes of ${MAX_FILTER_NODES}`);
  }
  validateWhereFields(expr, entityKey, schema);
}

function validateWhereFields(expr: WhereExpr, entityKey: string, schema: MeshSchema): void {
  const config = schema.entities[entityKey];
  const physical = new Set(config?.fields ?? []);
  const visit = (node: WhereExpr): void => {
    if ("and" in node) {
      node.and.forEach(visit);
      return;
    }
    if ("or" in node) {
      node.or.forEach(visit);
      return;
    }
    if ("not" in node) {
      visit(node.not);
      return;
    }
    if (isComputedField(config, node.field)) {
      throw new ValidationError(`Computed field '${node.field}' cannot be used in filters`);
    }
    if (!physical.has(node.field)) {
      throw new ValidationError(`Unknown filter field '${node.field}' on '${entityKey}'`);
    }
  };
  visit(expr);
}

function appendIdTiebreaker(
  orderBy: SortExpr[],
  entityKey: string,
  schema: MeshSchema,
): SortExpr[] {
  const idField = entityIdField(schema.entities[entityKey]);
  if (orderBy.some((entry) => "field" in entry && entry.field === idField)) {
    return orderBy;
  }
  return [...orderBy, { field: idField, direction: "asc", nulls: "last" }];
}

/** Stable ORDER BY for grouped queries — group keys, not the row id. */
function appendGroupByTiebreaker(
  orderBy: SortExpr[],
  groupBy: string[],
): SortExpr[] {
  const result = [...orderBy];
  for (const field of groupBy) {
    if (result.some((entry) => "field" in entry && entry.field === field)) {
      continue;
    }
    result.push({ field, direction: "asc", nulls: "last" });
  }
  return result;
}

function wireToAstNode(wire: ReadNodeWire): ASTNode {
  const node: ASTNode = { name: wire.name, fields: [], refs: [] };
  for (const [key, value] of Object.entries(wire.select)) {
    if (value === true) node.fields.push(key);
    else if (value && typeof value === "object") node.refs.push(wireToAstNode(value));
  }
  return node;
}

/**
 * Convert a plain parsed AST node (produced by the QL brace grammar) into a
 * {@link ReadNodeWire} carrying only a selection map. This lets QL queries flow
 * through the same normalization path as JSON queries so there is a single
 * internal read model regardless of wire encoding.
 */
export function astNodeToWire(node: ASTNode): ReadNodeWire {
  const select: Record<string, boolean | ReadNodeWire> = {};
  for (const field of node.fields) select[field] = true;
  for (const ref of node.refs) select[ref.name] = astNodeToWire(ref);
  return { name: node.name, select };
}

/** Normalize and validate a read tree against the schema. */
export function normalizeReadTree(
  wire: ReadNodeWire,
  schema: MeshSchema,
  options: { path?: string; parentEntity?: string; parentRef?: string } = {},
): { ast: AST; read: NormalizedReadNode } {
  const path = options.path ?? "";
  const entityKey = options.parentEntity
    ? resolveRefEntity(options.parentEntity, options.parentRef!, schema, path)
    : resolveEntityKey(wire.name, schema);

  if (!entityKey) {
    throw new ValidationError(`Unknown entity '${wire.name}'`);
  }

  const entityConfig = schema.entities[entityKey];
  const joinType = options.parentRef
    ? schema.joins[`${options.parentEntity}.${options.parentRef}`]?.type
    : undefined;

  if (joinType === "one" && (wire.where || wire.orderBy || wire.page)) {
    throw new ValidationError(`Controls are not allowed on one-relation '${wire.name}'`);
  }

  const knownFields = new Set(entityQueryableFields(entityConfig));
  for (const field of Object.keys(wire.select)) {
    if (wire.select[field] === true && !knownFields.has(field)) {
      throw new ValidationError(`Field '${field}' not found on entity '${wire.name}'`);
    }
  }

  validateWhere(wire.where, entityKey, schema);

  if (wire.groupBy && wire.groupBy.length > MAX_GROUP_KEYS) {
    throw new ValidationError(`groupBy exceeds maximum of ${MAX_GROUP_KEYS}`);
  }
  if (wire.aggregates && Object.keys(wire.aggregates).length > MAX_AGGREGATES) {
    throw new ValidationError(`aggregate exceeds maximum of ${MAX_AGGREGATES}`);
  }

  const mode =
    wire.groupBy?.length || wire.aggregates
      ? "aggregate"
      : "record";

  const orderBy =
    mode === "aggregate"
      ? appendGroupByTiebreaker(wire.orderBy ?? [], wire.groupBy ?? [])
      : appendIdTiebreaker(wire.orderBy ?? [], entityKey, schema);

  const pageFirst = wire.page?.first ?? DEFAULT_PAGE_FIRST;
  if (pageFirst > MAX_PAGE_FIRST) {
    throw new ValidationError(`page.first (${pageFirst}) exceeds maximum of ${MAX_PAGE_FIRST}`);
  }

  const refs: NormalizedReadNode[] = [];
  for (const [refName, refValue] of Object.entries(wire.select)) {
    if (refValue === true || !refValue || typeof refValue !== "object") continue;
    refs.push(
      normalizeReadTree(refValue, schema, {
        path: path ? `${path}.${refName}` : refName,
        parentEntity: wire.name,
        parentRef: refName,
      }).read,
    );
  }

  const read: NormalizedReadNode = {
    name: wire.name,
    entityKey,
    path,
    joinType,
    fields: Object.entries(wire.select)
      .filter(([, v]) => v === true)
      .map(([k]) => k),
    refs,
    ...(wire.where ? { where: wire.where } : {}),
    orderBy,
    ...(wire.page || joinType === "many" || !options.parentRef
      ? {
          page: {
            first: pageFirst,
            ...(wire.page?.after ? { after: wire.page.after } : {}),
          },
        }
      : {}),
    ...(wire.distinct ? { distinct: wire.distinct } : {}),
    ...(wire.groupBy ? { groupBy: wire.groupBy } : {}),
    ...(wire.aggregates ? { aggregates: wire.aggregates } : {}),
    ...(wire.having ? { having: wire.having } : {}),
    mode,
  };

  const ast: AST = { root: wireToAstNode(wire) };
  return { ast, read };
}

function resolveRefEntity(
  parentName: string,
  refName: string,
  schema: MeshSchema,
  path: string,
): string | undefined {
  const joinKey = `${parentName}.${refName}`;
  const join = schema.joins[joinKey];
  if (!join) {
    throw new ValidationError(`No join defined for '${joinKey}' at path '${path}'`);
  }
  return join.entity;
}

/** Find a normalized read node by dot path (empty string = root). */
export function readNodeAt(
  read: NormalizedReadNode,
  path: string,
): NormalizedReadNode | undefined {
  if (path === "" || path === read.path) return read;
  for (const ref of read.refs) {
    const found = readNodeAt(ref, path);
    if (found) return found;
  }
  return undefined;
}

/** Stable fingerprint for cursor scope validation. */
export function queryScopeFingerprint(read: NormalizedReadNode): string {
  const payload = JSON.stringify({
    entity: read.entityKey,
    path: read.path,
    where: read.where ?? null,
    orderBy: read.orderBy,
    distinct: read.distinct ?? null,
    groupBy: read.groupBy ?? null,
    aggregates: read.aggregates ?? null,
    having: read.having ?? null,
    mode: read.mode,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
