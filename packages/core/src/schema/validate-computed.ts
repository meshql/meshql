import { ValidationError } from "../errors/index.js";
import type {
  ComputedFieldDef,
  EntityConfig,
  MeshSchema,
} from "./schema.js";

/**
 * Validate computed field definitions on a schema.
 *
 * Rules:
 * - Computed names must not overlap physical `fields`
 * - `from` must be non-empty
 * - Same-entity deps must reference physical fields (not other computed)
 * - Cross-entity deps (`a.b`) must resolve to a join from this entity + a
 *   physical field on the target
 */
export function validateComputedFields(schema: MeshSchema): void {
  for (const [entityKey, config] of Object.entries(schema.entities)) {
    validateEntityComputed(entityKey, config, schema);
  }
}

function validateEntityComputed(
  entityKey: string,
  config: EntityConfig,
  schema: MeshSchema,
): void {
  const computed = config.computed;
  if (!computed) return;

  const physical = new Set(config.fields);

  for (const [name, def] of Object.entries(computed)) {
    if (physical.has(name)) {
      throw new ValidationError(
        `Computed field '${entityKey}.${name}' conflicts with physical field '${name}'`,
      );
    }
    if (!def.from || def.from.length === 0) {
      throw new ValidationError(
        `Computed field '${entityKey}.${name}' requires a non-empty 'from' array`,
      );
    }
    if (typeof def.compute !== "function") {
      throw new ValidationError(
        `Computed field '${entityKey}.${name}' requires a 'compute' function`,
      );
    }

    for (const dep of def.from) {
      validateComputedDep(entityKey, name, dep, config, schema, computed);
    }
  }
}

function validateComputedDep(
  entityKey: string,
  computedName: string,
  dep: string,
  config: EntityConfig,
  schema: MeshSchema,
  computed: Record<string, ComputedFieldDef>,
): void {
  if (dep.includes(".")) {
    const [refName, ...rest] = dep.split(".");
    const field = rest.join(".");
    if (!refName || !field || field.includes(".")) {
      throw new ValidationError(
        `Computed field '${entityKey}.${computedName}' has invalid cross-entity dep '${dep}' ` +
          `(expected 'join.field')`,
      );
    }
    const join = schema.joins[`${entityKey}.${refName}`];
    if (!join) {
      throw new ValidationError(
        `Computed field '${entityKey}.${computedName}' dep '${dep}' references unknown join ` +
          `'${entityKey}.${refName}'`,
      );
    }
    const target = schema.entities[join.entity];
    if (!target) {
      throw new ValidationError(
        `Computed field '${entityKey}.${computedName}' dep '${dep}' targets unknown entity ` +
          `'${join.entity}'`,
      );
    }
    if (target.computed?.[field]) {
      throw new ValidationError(
        `Computed field '${entityKey}.${computedName}' cannot depend on computed field ` +
          `'${join.entity}.${field}'`,
      );
    }
    if (!target.fields.includes(field)) {
      throw new ValidationError(
        `Computed field '${entityKey}.${computedName}' dep '${dep}' - unknown field ` +
          `'${field}' on entity '${join.entity}'`,
      );
    }
    return;
  }

  if (computed[dep]) {
    throw new ValidationError(
      `Computed field '${entityKey}.${computedName}' cannot depend on computed field ` +
        `'${entityKey}.${dep}'`,
    );
  }
  if (!config.fields.includes(dep)) {
    throw new ValidationError(
      `Computed field '${entityKey}.${computedName}' dep '${dep}' is not a physical field ` +
        `on entity '${entityKey}'`,
    );
  }
}
