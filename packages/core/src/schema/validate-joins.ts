import { ValidationError } from "../errors/index.js";
import type { JoinConfig, MeshSchema } from "./schema.js";
import { hasPolymorphicJoin, hasThroughJoin } from "./schema.js";

/**
 * Validate join definitions on a schema.
 *
 * Rules for polymorphic joins:
 * - `polymorphic` requires non-empty `entities` and no single `entity`
 * - normal joins require `entity`
 * - `through` and `polymorphic` are mutually exclusive
 * - polymorphic `type` must be `"one"` (v1)
 * - every `map` value must appear in `entities`, and all entity keys exist
 */
export function validateJoins(schema: MeshSchema): void {
  for (const [joinKey, join] of Object.entries(schema.joins)) {
    validateJoin(joinKey, join, schema);
  }
}

function validateJoin(
  joinKey: string,
  join: JoinConfig,
  schema: MeshSchema,
): void {
  const hasEntity = Boolean(join.entity);
  const hasEntities = Boolean(join.entities?.length);
  const isPoly = Boolean(join.polymorphic);

  if (isPoly && hasEntity) {
    throw new ValidationError(
      `Join '${joinKey}' cannot set both 'entity' and 'polymorphic'`,
    );
  }
  if (!isPoly && !hasEntity) {
    throw new ValidationError(
      `Join '${joinKey}' requires 'entity' (or 'polymorphic' + 'entities')`,
    );
  }
  if (isPoly && !hasEntities) {
    throw new ValidationError(
      `Join '${joinKey}' polymorphic requires non-empty 'entities'`,
    );
  }
  if (hasThroughJoin(join) && isPoly) {
    throw new ValidationError(
      `Join '${joinKey}' cannot combine 'through' and 'polymorphic'`,
    );
  }
  if (isPoly && join.type !== "one") {
    throw new ValidationError(
      `Join '${joinKey}' polymorphic only supports type 'one'`,
    );
  }

  if (join.entity && !schema.entities[join.entity]) {
    throw new ValidationError(
      `Join '${joinKey}' references unknown entity '${join.entity}'`,
    );
  }

  if (hasPolymorphicJoin(join)) {
    const poly = join.polymorphic;
    if (!poly.typeColumn || !poly.idColumn) {
      throw new ValidationError(
        `Join '${joinKey}' polymorphic requires typeColumn and idColumn`,
      );
    }
    const entitySet = new Set(join.entities);
    for (const entityKey of join.entities) {
      if (!schema.entities[entityKey]) {
        throw new ValidationError(
          `Join '${joinKey}' entities includes unknown entity '${entityKey}'`,
        );
      }
    }
    for (const [disc, entityKey] of Object.entries(poly.map)) {
      if (!entitySet.has(entityKey)) {
        throw new ValidationError(
          `Join '${joinKey}' polymorphic map '${disc}' → '${entityKey}' is not in entities`,
        );
      }
    }
  }
}
