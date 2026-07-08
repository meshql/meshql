import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  getTableColumns,
  is,
  One,
  Relations,
  Table,
  type Relation,
} from "drizzle-orm";
import type { EntityConfig, JoinConfig, MeshSchema } from "@meshql/core";

export interface SchemaFromDrizzleOptions {
  /**
   * Map a Drizzle schema export key / table name to a MeshQL entity key.
   * Defaults to stripping a trailing `s` (`users` → `user`).
   */
  entityKey?: (tableKey: string) => string;
}

function defaultEntityKey(tableKey: string): string {
  return tableKey.endsWith("s") ? tableKey.slice(0, -1) : tableKey;
}

function isRelations(value: unknown): value is Relations {
  return is(value as object, Relations);
}

function isTable(value: unknown): value is Table {
  return is(value as object, Table);
}

function isOneRelation(rel: Relation): rel is One {
  return is(rel, One) && Boolean(rel.config?.fields?.length);
}

/**
 * Build a MeshQL {@link MeshSchema} from Drizzle table objects and
 * `relations(...)` exports.
 */
export function schemaFromDrizzle(
  schema: Record<string, unknown>,
  options: SchemaFromDrizzleOptions = {},
): MeshSchema {
  const entityKeyFn = options.entityKey ?? defaultEntityKey;

  const tables: Record<string, Table> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (isTable(value) && !isRelations(value)) {
      tables[key] = value;
    }
  }

  if (Object.keys(tables).length === 0) {
    throw new Error(
      "schemaFromDrizzle: no Drizzle tables found in schema object",
    );
  }

  const extracted = extractTablesRelationalConfig(
    schema,
    createTableRelationsHelpers,
  );

  const entities: Record<string, EntityConfig> = {};
  const tableKeyToEntity: Record<string, string> = {};
  const entityTableName: Record<string, string> = {};

  for (const [tableKey, tableInfo] of Object.entries(extracted.tables)) {
    const entity = entityKeyFn(tableKey);
    tableKeyToEntity[tableKey] = entity;
    if (tableInfo.dbName) {
      tableKeyToEntity[tableInfo.dbName] = entity;
    }

    const tableObj = tables[tableKey];
    if (!tableObj) {
      continue;
    }
    const cols = getTableColumns(tableObj);
    const fields: string[] = [];
    const columns: Record<string, string> = {};
    let idField: string | undefined;

    for (const [prop, col] of Object.entries(cols)) {
      fields.push(prop);
      if (col.name && col.name !== prop) {
        columns[prop] = col.name;
      }
      if (col.primary) {
        idField = prop;
      }
    }

    entities[entity] = {
      type: {},
      fields,
      ...(idField && idField !== "id" ? { idField } : {}),
      table: tableKey,
      ...(Object.keys(columns).length > 0 ? { columns } : {}),
    };
    entityTableName[entity] = tableKey;
  }

  const joins: Record<string, JoinConfig> = {};

  for (const [tableKey, tableInfo] of Object.entries(extracted.tables)) {
    const parentEntity = tableKeyToEntity[tableKey];
    if (!parentEntity) continue;
    const parentTable = entityTableName[parentEntity];
    if (!parentTable) continue;

    for (const [refName, rel] of Object.entries(tableInfo.relations ?? {})) {
      const childTableKey = rel.referencedTableName;
      const childEntity = tableKeyToEntity[childTableKey];
      if (!childEntity) continue;
      const childTable = entityTableName[childEntity];
      if (!childTable) continue;

      const joinKey = `${parentEntity}.${refName}`;
      const one = isOneRelation(rel);

      let on: string;
      if (one && rel.config?.fields?.length && rel.config.references?.length) {
        on = rel.config.fields
          .map((fkCol, i) => {
            const refCol = rel.config!.references[i]!;
            return `${parentTable}.${fkCol.name} = ${childTable}.${refCol.name}`;
          })
          .join(" AND ");
      } else {
        const childInfo = extracted.tables[childTableKey];
        const back = Object.values(childInfo?.relations ?? {}).find(
          (r): r is One =>
            (r.referencedTableName === tableKey ||
              tableKeyToEntity[r.referencedTableName] === parentEntity) &&
            isOneRelation(r),
        );

        if (back?.config?.fields?.length && back.config.references?.length) {
          on = back.config.fields
            .map((fkCol, i) => {
              const refCol = back.config!.references[i]!;
              return `${childTable}.${fkCol.name} = ${parentTable}.${refCol.name}`;
            })
            .join(" AND ");
        } else {
          on = `${childTable}.${parentEntity}_id = ${parentTable}.id`;
        }
      }

      joins[joinKey] = {
        entity: childEntity,
        on,
        type: one ? "one" : "many",
        table: childTable,
      };
    }
  }

  return { entities, joins };
}
