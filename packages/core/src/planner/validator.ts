import { ValidationError } from "../errors/index.js";
import type { AST, ASTNode } from "../parser/ast.js";
import type { MeshSchema } from "../schema/schema.js";

/** Validate a parsed AST against the MeshQL schema. */
export function validateAst(ast: AST, schema: MeshSchema): AST {
  if (!schema.entities[ast.root.name]) {
    throw new ValidationError(`Unknown entity '${ast.root.name}'`);
  }

  validateNode(ast.root, schema);
  return ast;
}

function entityForRef(node: ASTNode, schema: MeshSchema, joinKey: string): string {
  const join = schema.joins[joinKey];
  if (join) {
    return join.entity;
  }
  if (schema.entities[node.name]) {
    return node.name;
  }
  const singular = node.name.replace(/s$/, "");
  if (schema.entities[singular]) {
    return singular;
  }
  return node.name;
}

function validateNode(node: ASTNode, schema: MeshSchema): void {
  const entityKey = schema.entities[node.name]
    ? node.name
    : node.name.replace(/s$/, "");
  const entityConfig = schema.entities[entityKey];

  if (!entityConfig) {
    throw new ValidationError(`Unknown entity '${node.name}'`);
  }

  const knownFields = new Set(entityConfig.fields);

  for (const field of node.fields) {
    if (!knownFields.has(field)) {
      throw new ValidationError(
        `Field '${field}' not found on entity '${node.name}'`,
      );
    }
  }

  for (const ref of node.refs) {
    const joinKey = `${node.name}.${ref.name}`;
    const join = schema.joins[joinKey];

    if (!join) {
      throw new ValidationError(`No join defined for '${joinKey}'`);
    }

    const refEntityKey = entityForRef(ref, schema, joinKey);
    const refEntity = schema.entities[refEntityKey];

    if (!refEntity) {
      throw new ValidationError(`Unknown entity '${ref.name}'`);
    }

    const refFields = new Set(refEntity.fields);
    for (const field of ref.fields) {
      if (!refFields.has(field)) {
        throw new ValidationError(
          `Field '${field}' not found on entity '${ref.name}'`,
        );
      }
    }

    validateNode(ref, schema);
  }
}
