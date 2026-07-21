import { ValidationError } from "../errors/index.js";
import type { AST, ASTNode } from "../parser/ast.js";
import type {
  ComputedFieldDef,
  EntityConfig,
  JoinConfig,
  MeshSchema,
} from "../schema/schema.js";
import {
  entityIdField,
  entityTable,
  isComputedField,
  resolveEntityKey,
} from "../schema/schema.js";
import type { QueryContext } from "../resolver/context.js";
import type { SqlTraceCollector } from "../trace/sql-trace.js";
import type { ListOptions } from "./list-options.js";
import type { NormalizedReadNode } from "../query/types.js";
import type { PlanComputedField } from "../computed/types.js";

export type { PlanComputedField };

/** Execution plan describing selected fields and joins for a query. */
export interface JoinPlan {
  rootEntity: string;
  fields: string[];
  /**
   * Root entity's identifying field. Resolvers should ensure this column is
   * present in the returned rows so the shaper can group/dedupe correctly.
   * Defaults to `"id"`.
   */
  idField: string;
  joins: ResolvedJoin[];
  context: QueryContext;
  /**
   * List-read options (pagination, filtering, ordering). Present only when
   * the request is a list query — point reads leave this undefined so
   * resolvers can distinguish the two cases with a simple `plan.list` check.
   */
  list?: ListOptions;
  /** Normalized read tree (root + nested relation controls). */
  read?: NormalizedReadNode;
  /**
   * Computed fields requested in the query. Deps are expanded into
   * {@link fields} / join fields for fetching; computed names are excluded
   * from SQL selection lists.
   */
  computedFields?: PlanComputedField[];
  /**
   * Populated when {@link ExecuteOptions.trace}.sql is enabled. Resolvers
   * should call {@link recordPlanSql} after building SQL.
   */
  sqlTrace?: SqlTraceCollector;
}

/** A resolved join from the query AST to a schema join definition. */
export interface ResolvedJoin {
  /**
   * Dot-separated ref path from the root selection, e.g. `"comments"` or
   * `"comments.author"`. Used by the SQL builders and shaper to disambiguate
   * repeated entity tables and nested field aliases.
   */
  path: string;
  /**
   * Schema join key: `{parentAstNodeName}.{refName}`, e.g. `"post.comments"`
   * or `"comments.author"`.
   */
  joinKey: string;
  entity: string;
  on: string;
  fields: string[];
  type: "one" | "many";
  /** Last segment of {@link path} — the ref name in the selection. */
  refName: string;
  /**
   * Identifying field on the joined entity. The shaper uses this to dedupe
   * `many` collections when multiple flat rows refer to the same nested record.
   * Defaults to `"id"`.
   */
  idField: string;
}

/** Options for {@link buildJoinPlan}. */
export interface BuildJoinPlanOptions {
  /** Normalized read tree. */
  read?: NormalizedReadNode;
}

function tablePrefix(entityKey: string, config?: EntityConfig): string {
  return entityTable(entityKey, config);
}

/** Qualified field path for a join at `joinPath`. */
export function qualifiedJoinField(joinPath: string, field: string): string {
  return `${joinPath}.${field}`;
}

function ensureJoin(
  nodeName: string,
  refName: string,
  parentJoinPath: string | undefined,
  joins: ResolvedJoin[],
  fields: string[],
  schema: MeshSchema,
): ResolvedJoin {
  const joinKey = `${nodeName}.${refName}`;
  const joinPath = parentJoinPath ? `${parentJoinPath}.${refName}` : refName;
  const existing = joins.find((j) => j.path === joinPath);
  if (existing) return existing;

  const joinConfig: JoinConfig | undefined = schema.joins[joinKey];
  if (!joinConfig) {
    throw new ValidationError(`No join defined for '${joinKey}'`);
  }

  const joinEntityConfig = schema.entities[joinConfig.entity];
  const joinIdField = entityIdField(joinEntityConfig);
  const joinFields = [qualifiedJoinField(joinPath, joinIdField)];
  fields.push(...joinFields);

  const resolved: ResolvedJoin = {
    path: joinPath,
    joinKey,
    entity: joinConfig.entity,
    on: joinConfig.on,
    fields: joinFields,
    type: joinConfig.type,
    refName,
    idField: joinIdField,
  };
  joins.push(resolved);
  return resolved;
}

function addPhysicalField(
  entityKey: string,
  field: string,
  joinPath: string | undefined,
  fields: string[],
  joinFields: string[] | undefined,
  schema: MeshSchema,
): void {
  const qualified = joinPath
    ? qualifiedJoinField(joinPath, field)
    : `${tablePrefix(entityKey, schema.entities[entityKey])}.${field}`;

  if (!fields.includes(qualified)) {
    fields.push(qualified);
  }
  if (joinFields && !joinFields.includes(qualified)) {
    joinFields.push(qualified);
  }
}

function expandComputedDeps(
  entityKey: string,
  def: ComputedFieldDef,
  nodeName: string,
  joinPath: string | undefined,
  fields: string[],
  joins: ResolvedJoin[],
  joinFields: string[] | undefined,
  schema: MeshSchema,
  requestedFields: Set<string>,
): Set<string> {
  const requestedDeps = new Set<string>();

  for (const dep of def.from) {
    if (requestedFields.has(dep)) {
      requestedDeps.add(dep);
    }

    if (!dep.includes(".")) {
      addPhysicalField(entityKey, dep, joinPath, fields, joinFields, schema);
      continue;
    }

    const [refName, ...rest] = dep.split(".");
    const field = rest.join(".");
    if (!refName || !field) {
      throw new ValidationError(`Invalid computed dependency '${dep}'`);
    }

    const childJoin = ensureJoin(
      nodeName,
      refName,
      joinPath,
      joins,
      fields,
      schema,
    );
    addPhysicalField(
      childJoin.entity,
      field,
      childJoin.path,
      fields,
      childJoin.fields,
      schema,
    );
  }

  return requestedDeps;
}

function planNodeFields(
  node: ASTNode,
  entityKey: string,
  parentJoinPath: string | undefined,
  fields: string[],
  joins: ResolvedJoin[],
  computedFields: PlanComputedField[],
  schema: MeshSchema,
  joinFields?: string[],
): void {
  const config = schema.entities[entityKey];
  const idField = entityIdField(config);
  const requested = new Set(node.fields);

  for (const field of node.fields) {
    const def = config?.computed?.[field];
    if (def) {
      const requestedDeps = expandComputedDeps(
        entityKey,
        def,
        node.name,
        parentJoinPath,
        fields,
        joins,
        joinFields,
        schema,
        requested,
      );
      computedFields.push({
        path: parentJoinPath ?? "",
        entity: entityKey,
        name: field,
        def,
        requestedDeps,
      });
      continue;
    }

    addPhysicalField(entityKey, field, parentJoinPath, fields, joinFields, schema);
  }

  // Always fetch id for shaping / dedupe
  if (!isComputedField(config, idField)) {
    addPhysicalField(entityKey, idField, parentJoinPath, fields, joinFields, schema);
  }
}

function planNodeRefs(
  node: ASTNode,
  entityKey: string,
  parentJoinPath: string | undefined,
  fields: string[],
  joins: ResolvedJoin[],
  computedFields: PlanComputedField[],
  schema: MeshSchema,
): void {
  for (const ref of node.refs) {
    const join = ensureJoin(
      node.name,
      ref.name,
      parentJoinPath,
      joins,
      fields,
      schema,
    );

    planNodeFields(
      ref,
      join.entity,
      join.path,
      fields,
      joins,
      computedFields,
      schema,
      join.fields,
    );

    planNodeRefs(
      ref,
      join.entity,
      join.path,
      fields,
      joins,
      computedFields,
      schema,
    );
  }
}

/** Build a join plan from a parsed query AST and schema. */
export function buildJoinPlan(
  ast: AST,
  schema: MeshSchema,
  context: QueryContext,
  options: BuildJoinPlanOptions = {},
): JoinPlan {
  const root = ast.root;
  const fields: string[] = [];
  const joins: ResolvedJoin[] = [];
  const computedFields: PlanComputedField[] = [];

  const rootEntityKey = resolveEntityKey(root.name, schema);
  if (!rootEntityKey) {
    throw new ValidationError(`Unknown entity '${root.name}'`);
  }

  const rootConfig = schema.entities[rootEntityKey];
  const rootIdField = entityIdField(rootConfig);

  planNodeFields(
    root,
    rootEntityKey,
    undefined,
    fields,
    idField: rootIdField,
    joins,
    computedFields,
    schema,
  );

  planNodeRefs(
    root,
    rootEntityKey,
    undefined,
    fields,
    joins,
    computedFields,
    schema,
  );

  const plan: JoinPlan = {
    rootEntity: rootEntityKey,
    fields,
    idField: rootIdField,
    joins,
    context,
  };

  if (computedFields.length > 0) {
    plan.computedFields = computedFields;
  }

  if (options.read) {
    plan.read = options.read;
  }

  if (options.read?.page && plan.context.entityId === undefined) {
    plan.list = {
      limit: options.read.page.first,
      ...(options.read.page.after ? { cursor: options.read.page.after } : {}),
      orderBy: options.read.orderBy
        .filter((entry): entry is { field: string; direction: "asc" | "desc" } => "field" in entry)
        .map((entry) => ({ field: entry.field, dir: entry.direction })),
      ...(options.read.where
        ? { filter: flattenWhereToLegacyFilters(options.read.where) }
        : {}),
    };
  }

  return plan;
}

function flattenWhereToLegacyFilters(
  expr: import("../query/types.js").WhereExpr,
): import("./list-options.js").Filter[] {
  if ("and" in expr) {
    return expr.and.flatMap(flattenWhereToLegacyFilters);
  }
  if ("or" in expr || "not" in expr) {
    return [];
  }
  if (expr.op === "isNull" || expr.op === "isNotNull") {
    return [];
  }
  return [{ field: expr.field, op: expr.op, value: expr.value }];
}

/** Collect a node and all nested reference nodes from an AST subtree. */
export function collectAstNodes(node: ASTNode): ASTNode[] {
  return [node, ...node.refs.flatMap(collectAstNodes)];
}

/** SQL / row alias prefix for a join path (dots → underscores). */
export function joinPathAlias(path: string): string {
  return path.replace(/\./g, "_");
}

/** Row alias for a qualified plan field (matches SQL builder output). */
export function rowAliasForQualifiedField(
  qualified: string,
  rootEntity: string,
  joinPaths: string[],
): string {
  const parsed = parseQualifiedPlanField(qualified, rootEntity, joinPaths);
  if (!parsed.joinPath) {
    return `${rootEntity}_${parsed.column}`;
  }
  return `${joinPathAlias(parsed.joinPath)}_${parsed.column}`;
}

/** Parse a plan field into a join path (if nested) and column name. */
export function parseQualifiedPlanField(
  qualified: string,
  rootEntity: string,
  joinPaths: string[],
): { joinPath: string | null; column: string } {
  const sorted = [...joinPaths].sort((a, b) => b.length - a.length);
  for (const path of sorted) {
    const prefix = `${path}.`;
    if (qualified.startsWith(prefix)) {
      return { joinPath: path, column: qualified.slice(prefix.length) };
    }
  }

  const dot = qualified.lastIndexOf(".");
  if (dot === -1) {
    return { joinPath: null, column: qualified };
  }

  const table = qualified.slice(0, dot);
  const column = qualified.slice(dot + 1);
  if (table === rootEntity || joinPaths.includes(table)) {
    return { joinPath: table, column };
  }

  return { joinPath: null, column };
}
