import { ValidationError } from "../errors/index.js";
import type { AST, ASTNode } from "../parser/ast.js";
import type { MeshSchema } from "../schema/schema.js";
import { resolveEntityKey } from "../schema/schema.js";
import { MAX_LIST_LIMIT, type ListOptions } from "./list-options.js";

/**
 * Validate a parsed AST against the MeshQL schema.
 *
 * Entity resolution uses {@link resolveEntityKey} for the root, and each
 * ref's declared join config (`join.entity`) for nested nodes. There is no
 * naive singularization anywhere along the ref path \u2014 so irregular
 * plurals like `addresses` \u2192 `address` work as long as the entity is
 * reachable via a declared join (which every ref must have).
 *
 * When `ast.list` is present it is validated against the root entity: unknown
 * fields, oversized `limit`, and empty order/filter arrays all throw
 * {@link ValidationError} so the HTTP boundary can return a 400 without
 * having to peek at the plan itself.
 */
export function validateAst(ast: AST, schema: MeshSchema): AST {
  const rootEntityKey = resolveEntityKey(ast.root.name, schema);
  if (!rootEntityKey) {
    throw new ValidationError(`Unknown entity '${ast.root.name}'`);
  }
  validateNode(ast.root, rootEntityKey, schema);
  if (ast.list) {
    validateListOptions(ast.list, schema, rootEntityKey);
  }
  return ast;
}

function validateNode(node: ASTNode, entityKey: string, schema: MeshSchema): void {
  const entityConfig = schema.entities[entityKey];
  if (!entityConfig) {
    // Defensive: entityKey came from resolveEntityKey or a join config, so
    // this is really unreachable at runtime. Kept as a guard to fail loud.
    throw new ValidationError(`Unknown entity '${node.name}'`);
  }

  const knownFields = new Set(entityConfig.fields);

  for (const field of node.fields) {
    if (!knownFields.has(field)) {
      throw new ValidationError(`Field '${field}' not found on entity '${node.name}'`);
    }
  }

  for (const ref of node.refs) {
    const joinKey = `${node.name}.${ref.name}`;
    const join = schema.joins[joinKey];

    if (!join) {
      throw new ValidationError(`No join defined for '${joinKey}'`);
    }

    const refEntity = schema.entities[join.entity];
    if (!refEntity) {
      throw new ValidationError(
        `Unknown entity '${join.entity}' (referenced by join '${joinKey}')`,
      );
    }

    const refFields = new Set(refEntity.fields);
    for (const field of ref.fields) {
      if (!refFields.has(field)) {
        throw new ValidationError(`Field '${field}' not found on entity '${ref.name}'`);
      }
    }

    validateNode(ref, join.entity, schema);
  }
}

/**
 * Validate a `$list` payload against the schema of the root entity.
 *
 * List options only apply to the root entity today \u2014 nested joins can't
 * be paginated/filtered independently. This mirrors what the reference SQL
 * builders can actually produce.
 */
function validateListOptions(
  list: ListOptions,
  schema: MeshSchema,
  rootEntityKey: string,
): void {
  const rootConfig = schema.entities[rootEntityKey];
  const knownFields = new Set(rootConfig?.fields ?? []);

  if (list.limit !== undefined) {
    if (list.limit > MAX_LIST_LIMIT) {
      throw new ValidationError(
        `'list.limit' (${list.limit}) exceeds maximum of ${MAX_LIST_LIMIT}`,
      );
    }
    if (list.limit < 1) {
      throw new ValidationError("'list.limit' must be at least 1");
    }
  }

  if (list.orderBy) {
    if (list.orderBy.length === 0) {
      throw new ValidationError("'list.orderBy' must not be empty when present");
    }
    for (const [i, order] of list.orderBy.entries()) {
      if (!knownFields.has(order.field)) {
        throw new ValidationError(
          `'list.orderBy[${i}].field' - unknown field '${order.field}' on entity '${rootEntityKey}'`,
        );
      }
    }
  }

  if (list.filter) {
    if (list.filter.length === 0) {
      throw new ValidationError("'list.filter' must not be empty when present");
    }
    for (const [i, filter] of list.filter.entries()) {
      if (!knownFields.has(filter.field)) {
        throw new ValidationError(
          `'list.filter[${i}].field' - unknown field '${filter.field}' on entity '${rootEntityKey}'`,
        );
      }
    }
  }
}
