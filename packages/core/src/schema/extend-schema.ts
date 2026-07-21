import type { EntityConfig, JoinConfig, MeshSchema } from "./schema.js";

/**
 * Partial schema used to override / extend an inferred or hand-written
 * {@link MeshSchema}. Field arrays on entities are **replaced** (not
 * concatenated) so callers can hide fields explicitly.
 */
export type MeshSchemaOverride = {
  entities?: Record<string, Partial<EntityConfig>>;
  joins?: Record<string, JoinConfig | undefined>;
};

/**
 * Shallow-merge a base MeshQL schema with an override.
 *
 * - Entity configs are merged field-by-field; `fields` / `columns` /
 *   `table` / `idField` / `computed` from the override win when present.
 * - Join entries set to `undefined` are removed; otherwise they replace or
 *   add the join key.
 * - The base schema is never mutated.
 *
 * @example
 * ```ts
 * const schema = extendSchema(await schemaFromPrisma("./schema.prisma"), {
 *   entities: { user: { fields: ["id", "name"] } }, // hide email
 * });
 * ```
 */
export function extendSchema(
  base: MeshSchema,
  override: MeshSchemaOverride = {},
): MeshSchema {
  const entities: Record<string, EntityConfig> = {};

  for (const [key, entity] of Object.entries(base.entities)) {
    const patch = override.entities?.[key];
    if (!patch) {
      entities[key] = { ...entity, columns: entity.columns ? { ...entity.columns } : undefined };
      continue;
    }

    entities[key] = {
      fields: patch.fields !== undefined ? [...patch.fields] : [...entity.fields],
      idField: patch.idField !== undefined ? patch.idField : entity.idField,
      table: patch.table !== undefined ? patch.table : entity.table,
      columns:
        patch.columns !== undefined
          ? { ...patch.columns }
          : entity.columns
            ? { ...entity.columns }
            : undefined,
      computed:
        patch.computed !== undefined
          ? { ...patch.computed }
          : entity.computed
            ? { ...entity.computed }
            : undefined,
    };
  }

  // Allow adding entities that only appear in the override.
  for (const [key, patch] of Object.entries(override.entities ?? {})) {
    if (entities[key] || !patch.fields) {
      continue;
    }
    entities[key] = {
      fields: [...patch.fields],
      idField: patch.idField,
      table: patch.table,
      columns: patch.columns ? { ...patch.columns } : undefined,
      computed: patch.computed ? { ...patch.computed } : undefined,
    };
  }

  const joins: Record<string, JoinConfig> = {};
  for (const [key, join] of Object.entries(base.joins)) {
    joins[key] = { ...join };
  }

  for (const [key, join] of Object.entries(override.joins ?? {})) {
    if (join === undefined) {
      delete joins[key];
      continue;
    }
    joins[key] = { ...join };
  }

  return { entities, joins };
}
