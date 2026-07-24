import { ValidationError } from "../errors/index.js";
import type { AST, ASTNode } from "../parser/ast.js";
import type { MeshSchema } from "../schema/schema.js";
import {
  entityQueryableFields,
  hasPolymorphicJoin,
  joinTargetEntity,
  resolveEntityKey,
} from "../schema/schema.js";

/**
 * Validate a parsed AST against the MeshQL schema.
 *
 * Entity resolution uses {@link resolveEntityKey} for the root, and each
 * ref's declared join config (`join.entity` / polymorphic `entities`) for
 * nested nodes. There is no naive singularization anywhere along the ref
 * path — so irregular plurals like `addresses` → `address` work as long as
 * the entity is reachable via a declared join (which every ref must have).
 *
 * Read controls (filtering, ordering, pagination, aggregates) are validated
 * during normalization; this pass only checks selection fields and joins.
 */
export function validateAst(ast: AST, schema: MeshSchema): AST {
  const rootEntityKey = resolveEntityKey(ast.root.name, schema);
  if (!rootEntityKey) {
    throw new ValidationError(`Unknown entity '${ast.root.name}'`);
  }
  validateNode(ast.root, rootEntityKey, schema);
  return ast;
}

function validateNode(node: ASTNode, entityKey: string, schema: MeshSchema): void {
  const entityConfig = schema.entities[entityKey];
  if (!entityConfig) {
    throw new ValidationError(`Unknown entity '${node.name}'`);
  }

  const knownFields = new Set(entityQueryableFields(entityConfig));

  for (const field of node.fields) {
    if (!knownFields.has(field)) {
      throw new ValidationError(`Field '${field}' not found on entity '${node.name}'`);
    }
  }

  for (const ref of node.refs) {
    const joinKey = `${entityKey}.${ref.name}`;
    const join = schema.joins[joinKey];

    if (!join) {
      throw new ValidationError(`No join defined for '${joinKey}'`);
    }

    if (hasPolymorphicJoin(join)) {
      if (ref.refs.length > 0) {
        throw new ValidationError(
          `Nested selections under polymorphic join '${joinKey}' are not supported`,
        );
      }
      const unionFields = new Set<string>();
      for (const target of join.entities) {
        for (const name of entityQueryableFields(schema.entities[target])) {
          unionFields.add(name);
        }
      }
      for (const field of ref.fields) {
        if (!unionFields.has(field)) {
          throw new ValidationError(
            `Field '${field}' not found on any polymorphic target of '${joinKey}'`,
          );
        }
      }
      continue;
    }

    const target = joinTargetEntity(join);
    const refEntity = schema.entities[target];
    if (!refEntity) {
      throw new ValidationError(
        `Unknown entity '${target}' (referenced by join '${joinKey}')`,
      );
    }

    const refFields = new Set(entityQueryableFields(refEntity));
    for (const field of ref.fields) {
      if (!refFields.has(field)) {
        throw new ValidationError(`Field '${field}' not found on entity '${ref.name}'`);
      }
    }

    validateNode(ref, target, schema);
  }
}
