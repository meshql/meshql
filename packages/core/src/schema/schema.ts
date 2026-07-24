import type { QueryContext } from "../resolver/context.js";

/** MeshQL schema describing entities and join relationships. */
export interface MeshSchema {
  entities: Record<string, EntityConfig>;
  joins: Record<string, JoinConfig>;
}

/**
 * Virtual field computed at runtime from other fields.
 *
 * Computed names are queryable automatically — they do **not** need to be
 * listed in {@link EntityConfig.fields} (those stay physical/SQL columns).
 */
export interface ComputedFieldDef {
  /**
   * Dependency field paths relative to this entity.
   * Same-entity: `"firstName"`. Cross-entity: `"customer.firstName"`.
   */
  from: string[];
  /**
   * Produce the virtual value. Keys in `deps` match {@link from} entries
   * exactly (e.g. `deps.firstName`, `deps["customer.firstName"]`).
   */
  compute: (deps: Record<string, unknown>) => unknown;
  /** Optional runtime type hint for playground / docs introspection. */
  type?: "string" | "number" | "boolean";
}

/** Configuration for a single entity exposed by MeshQL. */
export interface EntityConfig {
  /** Physical / resolver-backed field names (not computed). */
  fields: string[];
  /**
   * Name of the field that uniquely identifies a row of this entity.
   * Defaults to `"id"`. Used by the shaper to dedupe nested collections
   * and by `shapeMany` to group flat rows back into root records.
   */
  idField?: string;
  table?: string;
  columns?: Record<string, string>;
  /**
   * Virtual fields computed after the resolver runs. Keys are queryable
   * field names; values declare deps + `compute`.
   */
  computed?: Record<string, ComputedFieldDef>;
}

/**
 * Junction / pivot table for many-to-many relations.
 *
 * When present on a {@link JoinConfig}, SQL builders emit a two-hop join
 * (`parent → junction → child`) instead of a single LEFT JOIN on `on`.
 */
export interface ThroughConfig {
  /** Physical junction table name (e.g. `"_PostToTag"` or `"post_tags"`). */
  table: string;
  /** Column in the junction referencing the parent (e.g. `"post_id"` or `"A"`). */
  from: string;
  /** Column in the junction referencing the child (e.g. `"tag_id"` or `"B"`). */
  to: string;
}

/** Join definition between a root entity and a nested relation. */
export interface JoinConfig {
  entity: string;
  /**
   * Join predicate for a direct FK hop.
   * Ignored by SQL builders when {@link through} is set (kept for docs / tooling).
   */
  on: string;
  type: "one" | "many";
  table?: string;
  /**
   * Junction / pivot table for many-to-many relations.
   * When present, the SQL builder emits a two-hop join:
   *   parent → junction → child
   */
  through?: ThroughConfig;
}

/** Alias for {@link MeshSchema}. */
export type MeshConfig = MeshSchema;

/** Resolve the SQL table name for an entity. */
export function entityTable(entity: string, config?: EntityConfig): string {
  return config?.table ?? (entity.endsWith("s") ? entity : `${entity}s`);
}

/** Resolve the identifying field for an entity. Defaults to `"id"`. */
export function entityIdField(config?: EntityConfig): string {
  return config?.idField ?? "id";
}

/**
 * Resolve the physical SQL column for an entity's id field.
 * Honors {@link EntityConfig.columns} remapping (e.g. `uuid` → `"user_uuid"`).
 */
export function entityPhysicalIdColumn(config?: EntityConfig): string {
  const idField = entityIdField(config);
  return config?.columns?.[idField] ?? idField;
}

/** True when the join declares a many-to-many junction via {@link JoinConfig.through}. */
export function hasThroughJoin(
  join: JoinConfig | undefined,
): join is JoinConfig & { through: ThroughConfig } {
  return Boolean(join?.through);
}

/** Queryable field names: physical fields ∪ computed keys. */
export function entityQueryableFields(config?: EntityConfig): string[] {
  if (!config) return [];
  const names = [...config.fields];
  if (config.computed) {
    names.push(...Object.keys(config.computed));
  }
  return names;
}

/** True when `field` is a computed field on the entity. */
export function isComputedField(
  config: EntityConfig | undefined,
  field: string,
): boolean {
  return Boolean(config?.computed?.[field]);
}

/**
 * Resolve an arbitrary name (entity key or SQL table name) to a declared
 * entity key.
 *
 * Lookup order:
 *   1. Exact match against `schema.entities` keys.
 *   2. Match against each entity's `entityTable(...)` — so a plural table
 *      name like `users` resolves to entity key `user`.
 *   3. Naive singular fallback (`replace(/s$/, "")`) for backwards
 *      compatibility with the pre-0.3 planner.
 *
 * Returns `undefined` when no entity matches. Users with irregular plurals
 * (e.g. `address` → `addresses`) should declare `entities.address.table =
 * "addresses"` so step 2 succeeds; the naive fallback only handles regular
 * `+s` pluralization.
 */
export function resolveEntityKey(name: string, schema: MeshSchema): string | undefined {
  if (schema.entities[name]) return name;

  for (const [key, config] of Object.entries(schema.entities)) {
    if (entityTable(key, config) === name) return key;
  }

  if (name.endsWith("s")) {
    const singular = name.slice(0, -1);
    if (schema.entities[singular]) return singular;
  }

  return undefined;
}

export type { QueryContext };
