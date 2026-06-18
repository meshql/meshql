import { ValidationError } from "../errors/index.js";
import type { AST, ASTNode } from "../parser/ast.js";
import type { JoinConfig, MeshSchema } from "../schema/schema.js";
import type { QueryContext } from "../resolver/context.js";

/** Execution plan describing selected fields and joins for a query. */
export interface JoinPlan {
  rootEntity: string;
  fields: string[];
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

  const rootPrefix = tablePrefix(root.name);
  for (const field of root.fields) {
    fields.push(`${rootPrefix}.${field}`);
  }

  for (const ref of root.refs) {
    const joinKey = `${root.name}.${ref.name}`;
    const joinConfig: JoinConfig | undefined = schema.joins[joinKey];

    if (!joinConfig) {
      throw new ValidationError(`No join defined for '${joinKey}'`);
    }

    const joinFields = ref.fields.map((f) => `${ref.name}.${f}`);
    fields.push(...joinFields);

    joins.push({
      entity: joinConfig.entity,
      on: joinConfig.on,
      fields: joinFields,
      type: joinConfig.type,
      refName: ref.name,
    });
  }

  return {
    rootEntity: root.name,
    fields,
    joins,
    context,
  };
}

/** Collect a node and all nested reference nodes from an AST subtree. */
export function collectAstNodes(node: ASTNode): ASTNode[] {
  return [node, ...node.refs.flatMap(collectAstNodes)];
}
