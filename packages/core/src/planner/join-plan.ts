import { ValidationError } from "../errors/index.js";
import type { AST, ASTNode } from "../parser/ast.js";
import type { JoinConfig, MeshSchema } from "../schema/schema.js";
import { entityIdField } from "../schema/schema.js";
import type { QueryContext } from "../resolver/context.js";

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
}

/** A resolved join from the query AST to a schema join definition. */
export interface ResolvedJoin {
  entity: string;
  on: string;
  fields: string[];
  type: "one" | "many";
  refName: string;
  /**
   * Identifying field on the joined entity. The shaper uses this to dedupe
   * `many` collections when multiple flat rows refer to the same nested record.
   * Defaults to `"id"`.
   */
  idField: string;
}

function tablePrefix(entity: string): string {
  return entity.endsWith("s") ? entity : `${entity}s`;
}

/** Build a join plan from a parsed query AST and schema. */
export function buildJoinPlan(
  ast: AST,
  schema: MeshSchema,
  context: QueryContext,
): JoinPlan {
  const root = ast.root;
  const fields: string[] = [];
  const joins: ResolvedJoin[] = [];

  const rootConfig = schema.entities[root.name];
  const rootIdField = entityIdField(rootConfig);
  const rootPrefix = tablePrefix(root.name);

  const rootFieldSet = new Set<string>();
  for (const field of root.fields) {
    fields.push(`${rootPrefix}.${field}`);
    rootFieldSet.add(field);
  }
  // Ensure the root identifying field is always selected so the shaper can
  // group rows; the shaper only emits AST-requested fields, so an internally
  // added id column does not leak into the response.
  if (!rootFieldSet.has(rootIdField)) {
    fields.push(`${rootPrefix}.${rootIdField}`);
  }

  for (const ref of root.refs) {
    const joinKey = `${root.name}.${ref.name}`;
    const joinConfig: JoinConfig | undefined = schema.joins[joinKey];

    if (!joinConfig) {
      throw new ValidationError(`No join defined for '${joinKey}'`);
    }

    const joinEntityConfig = schema.entities[joinConfig.entity];
    const joinIdField = entityIdField(joinEntityConfig);

    const refFieldSet = new Set<string>(ref.fields);
    const joinFields = ref.fields.map((f) => `${ref.name}.${f}`);
    // Same rationale as root: ensure the nested entity's id is queried so the
    // shaper can dedupe many-collections produced by Cartesian-product rows.
    if (!refFieldSet.has(joinIdField)) {
      joinFields.push(`${ref.name}.${joinIdField}`);
    }

    fields.push(...joinFields);

    joins.push({
      entity: joinConfig.entity,
      on: joinConfig.on,
      fields: joinFields,
      type: joinConfig.type,
      refName: ref.name,
      idField: joinIdField,
    });
  }

  return {
    rootEntity: root.name,
    fields,
    idField: rootIdField,
    joins,
    context,
  };
}

/** Collect a node and all nested reference nodes from an AST subtree. */
export function collectAstNodes(node: ASTNode): ASTNode[] {
  return [node, ...node.refs.flatMap(collectAstNodes)];
}
