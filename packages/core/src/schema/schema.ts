/** MeshQL schema describing entities and join relationships. */
export interface MeshSchema {
  entities: Record<string, EntityConfig>;
  joins: Record<string, JoinConfig>;
}

/** Configuration for a single entity exposed by MeshQL. */
export interface EntityConfig {
  type: unknown;
  fields: string[];
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
