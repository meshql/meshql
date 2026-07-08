import { readFile } from "node:fs/promises";
import {
  getSchema,
  type Attribute,
  type BlockAttribute,
  type Field,
  type KeyValue,
  type Model,
  type RelationArray,
  type Value,
} from "@mrleebo/prisma-ast";
import type { EntityConfig, JoinConfig, MeshSchema } from "@meshql/core";

const PRISMA_SCALARS = new Set([
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes",
  "Unsupported",
]);

export interface SchemaFromPrismaOptions {
  /**
   * Convert Prisma model names (`User`) to MeshQL entity keys.
   * Defaults to lowercasing the first character (`user`).
   */
  entityKey?: (modelName: string) => string;
}

function defaultEntityKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function unwrapString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.replace(/^"|"$/g, "");
}

function fieldTypeName(field: Field): string | undefined {
  return typeof field.fieldType === "string" ? field.fieldType : undefined;
}

function findFieldAttr(field: Field, name: string): Attribute | undefined {
  return field.attributes?.find((a) => a.name === name);
}

function findModelAttr(model: Model, name: string): BlockAttribute | undefined {
  for (const p of model.properties) {
    if (p.type === "attribute" && p.name === name) {
      return p;
    }
  }
  return undefined;
}

function arrayArgs(value: Value | KeyValue | undefined): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  if ((value as RelationArray).type === "array") {
    return ((value as RelationArray).args ?? []).filter(
      (x): x is string => typeof x === "string",
    );
  }
  return [];
}

function relationMeta(field: Field): { fields: string[]; references: string[] } {
  const attr = findFieldAttr(field, "relation");
  if (!attr?.args) {
    return { fields: [], references: [] };
  }

  let fields: string[] = [];
  let references: string[] = [];

  for (const arg of attr.args) {
    const value = arg.value;
    if (!value || typeof value !== "object") {
      continue;
    }
    if ((value as KeyValue).type !== "keyValue") {
      continue;
    }
    const kv = value as KeyValue;
    const items = arrayArgs(kv.value);
    if (kv.key === "fields") fields = items;
    if (kv.key === "references") references = items;
  }

  return { fields, references };
}

function isModelField(field: Field, modelNames: Set<string>): boolean {
  const typeName = fieldTypeName(field);
  return Boolean(typeName && modelNames.has(typeName));
}

/**
 * Parse a Prisma schema source string into a MeshQL {@link MeshSchema}.
 */
export function schemaFromPrismaSource(
  source: string,
  options: SchemaFromPrismaOptions = {},
): MeshSchema {
  const entityKey = options.entityKey ?? defaultEntityKey;
  const ast = getSchema(source);
  const models = ast.list.filter((item): item is Model => item.type === "model");
  const modelNames = new Set(models.map((m) => m.name));
  const modelByName = new Map(models.map((m) => [m.name, m]));

  const entities: Record<string, EntityConfig> = {};
  const tableByEntity: Record<string, string> = {};

  for (const model of models) {
    const key = entityKey(model.name);
    const fields = model.properties.filter((p): p is Field => p.type === "field");
    const scalarFields = fields.filter((f) => !isModelField(f, modelNames));

    const columns: Record<string, string> = {};
    let idField: string | undefined;

    for (const field of scalarFields) {
      if (findFieldAttr(field, "id")) {
        idField = field.name;
      }
      const mapAttr = findFieldAttr(field, "map");
      const mapped = unwrapString(mapAttr?.args?.[0]?.value);
      if (mapped && mapped !== field.name) {
        columns[field.name] = mapped;
      }
    }

    const tableMap = findModelAttr(model, "map");
    const table = unwrapString(tableMap?.args?.[0]?.value) ?? undefined;

    entities[key] = {
      type: {},
      fields: scalarFields.map((f) => f.name),
      ...(idField && idField !== "id" ? { idField } : {}),
      ...(table ? { table } : {}),
      ...(Object.keys(columns).length > 0 ? { columns } : {}),
    };
    tableByEntity[key] = table ?? `${key}s`;
  }

  const joins: Record<string, JoinConfig> = {};

  for (const model of models) {
    const parentKey = entityKey(model.name);
    const parentTable = tableByEntity[parentKey]!;
    const fields = model.properties.filter((p): p is Field => p.type === "field");

    for (const field of fields) {
      const typeName = fieldTypeName(field);
      if (!typeName || !modelNames.has(typeName)) {
        continue;
      }

      const childKey = entityKey(typeName);
      const childTable = tableByEntity[childKey]!;
      const childModel = modelByName.get(typeName);
      const joinKey = `${parentKey}.${field.name}`;
      const type: "one" | "many" = field.array ? "many" : "one";
      const meta = relationMeta(field);

      let on: string;

      if (meta.fields.length > 0 && meta.references.length > 0) {
        on = meta.fields
          .map((fk, i) => {
            const ref = meta.references[i] ?? "id";
            const fkCol = entities[parentKey]?.columns?.[fk] ?? fk;
            const refCol = entities[childKey]?.columns?.[ref] ?? ref;
            return `${parentTable}.${fkCol} = ${childTable}.${refCol}`;
          })
          .join(" AND ");
      } else if (childModel) {
        const back = childModel.properties
          .filter((p): p is Field => p.type === "field")
          .find((f) => {
            if (fieldTypeName(f) !== model.name) return false;
            return relationMeta(f).fields.length > 0;
          });

        if (back) {
          const backMeta = relationMeta(back);
          on = backMeta.fields
            .map((fk, i) => {
              const ref = backMeta.references[i] ?? "id";
              const fkCol = entities[childKey]?.columns?.[fk] ?? fk;
              const refCol = entities[parentKey]?.columns?.[ref] ?? ref;
              return `${childTable}.${fkCol} = ${parentTable}.${refCol}`;
            })
            .join(" AND ");
        } else {
          on = `${childTable}.${parentKey}_id = ${parentTable}.id`;
        }
      } else {
        on = `${childTable}.${parentKey}_id = ${parentTable}.id`;
      }

      joins[joinKey] = {
        entity: childKey,
        on,
        type,
        table: childTable,
      };
    }
  }

  // Ensure PRISMA_SCALARS stays referenced for future Unsupported filtering
  void PRISMA_SCALARS;

  return { entities, joins };
}

/**
 * Read a `schema.prisma` file and convert it to a MeshQL schema.
 */
export async function schemaFromPrisma(
  path: string,
  options?: SchemaFromPrismaOptions,
): Promise<MeshSchema> {
  const source = await readFile(path, "utf8");
  return schemaFromPrismaSource(source, options);
}
