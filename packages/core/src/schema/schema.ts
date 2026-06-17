export interface MeshSchema {
  entities: Record<string, EntityConfig>;
  joins: Record<string, JoinConfig>;
}

export interface EntityConfig {
  type: unknown;
  fields: string[];
  table?: string;
  columns?: Record<string, string>;
}

export interface JoinConfig {
  entity: string;
  on: string;
  type: "one" | "many";
  table?: string;
}

export type MeshConfig = MeshSchema;

export function entityTable(entity: string, config?: EntityConfig): string {
  return config?.table ?? (entity.endsWith("s") ? entity : `${entity}s`);
}
