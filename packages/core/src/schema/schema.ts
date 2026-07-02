/** MeshQL schema describing entities and join relationships. */
export interface MeshSchema {
  entities: Record<string, EntityConfig>;
  joins: Record<string, JoinConfig>;
}

/** Configuration for a single entity exposed by MeshQL. */
export interface EntityConfig {
  type: unknown;
  fields: string[];
  /**
   * Name of the field that uniquely identifies a row of this entity.
   * Defaults to `"id"`. Used by the shaper to dedupe nested collections
   * and by `shapeMany` to group flat rows back into root records.
   */
  idField?: string;
  table?: string;
  columns?: Record<string, string>;
}

/** Join definition between a root entity and a nested relation. */
export interface JoinConfig {
  entity: string;
  on: string;
  type: "one" | "many";
  table?: string;
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
