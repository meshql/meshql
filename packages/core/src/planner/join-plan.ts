import { ValidationError } from "../errors/index.js";
import type { AST, ASTNode } from "../parser/ast.js";
import type { EntityConfig, JoinConfig, MeshSchema } from "../schema/schema.js";
import { entityIdField, entityTable, resolveEntityKey } from "../schema/schema.js";
import type { QueryContext } from "../resolver/context.js";
import type { ListOptions } from "./list-options.js";

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
  /** List-read metadata attached to the returned plan. */
  list?: ListOptions;
}

/**
 * SQL table alias for an entity, given the entity's config.
 *
 * Prefer this over the raw AST name so entities with irregular plurals
 * (declared via `config.table`) render correctly in `SELECT` prefixes.
 */
function tablePrefix(entityKey: string, config?: EntityConfig): string {
  return entityTable(entityKey, config);
}

/** Qualified field path for a join at `joinPath`. */
export function qualifiedJoinField(joinPath: string, field: string): string {
  return `${joinPath}.${field}`;
}

function planNodeRefs(
  node: ASTNode,
  entityKey: string,
  parentJoinPath: string | undefined,
  fields: string[],
  joins: ResolvedJoin[],
  schema: MeshSchema,
): void {
  for (const ref of node.refs) {
    const joinKey = `${node.name}.${ref.name}`;
    const joinConfig: JoinConfig | undefined = schema.joins[joinKey];

    if (!joinConfig) {
      throw new ValidationError(`No join defined for '${joinKey}'`);
    }

    const joinEntityConfig = schema.entities[joinConfig.entity];
    const joinIdField = entityIdField(joinEntityConfig);
    const joinPath = parentJoinPath ? `${parentJoinPath}.${ref.name}` : ref.name;

    const refFieldSet = new Set<string>(ref.fields);
    const joinFields = ref.fields.map((f) => qualifiedJoinField(joinPath, f));
    if (!refFieldSet.has(joinIdField)) {
      joinFields.push(qualifiedJoinField(joinPath, joinIdField));
    }

    fields.push(...joinFields);

    joins.push({
      path: joinPath,
      joinKey,
      entity: joinConfig.entity,
      on: joinConfig.on,
      fields: joinFields,
      type: joinConfig.type,
      refName: ref.name,
      idField: joinIdField,
    });

    planNodeRefs(ref, joinConfig.entity, joinPath, fields, joins, schema);
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

  const rootEntityKey = resolveEntityKey(root.name, schema);
  if (!rootEntityKey) {
    throw new ValidationError(`Unknown entity '${root.name}'`);
  }

  const rootConfig = schema.entities[rootEntityKey];
  const rootIdField = entityIdField(rootConfig);
  const rootPrefix = tablePrefix(rootEntityKey, rootConfig);

  const rootFieldSet = new Set<string>();
  for (const field of root.fields) {
    fields.push(`${rootPrefix}.${field}`);
    rootFieldSet.add(field);
  }
  if (!rootFieldSet.has(rootIdField)) {
    fields.push(`${rootPrefix}.${rootIdField}`);
  }

  planNodeRefs(root, rootEntityKey, undefined, fields, joins, schema);

  const plan: JoinPlan = {
    rootEntity: rootEntityKey,
    fields,
    idField: rootIdField,
    joins,
    context,
  };

  if (options.list) {
    plan.list = options.list;
  }

  return plan;
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
