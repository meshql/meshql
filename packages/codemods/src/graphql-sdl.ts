import type { EntityConfig, JoinConfig, MeshSchema } from "@meshql/core";
import {
  parse,
  type DocumentNode,
  type FieldDefinitionNode,
  type ObjectTypeDefinitionNode,
} from "graphql";

export interface CodemodReport {
  converted: string[];
  manual: string[];
  skipped: string[];
}

export interface GraphqlSdlResult {
  schema: MeshSchema;
  report: CodemodReport;
  resolverStubs: string;
}

const ROOT_TYPES = new Set(["Query", "Mutation", "Subscription"]);

function entityKey(typeName: string): string {
  return typeName.charAt(0).toLowerCase() + typeName.slice(1);
}

function isScalarGraphQLType(typeName: string): boolean {
  return ["ID", "String", "Int", "Float", "Boolean"].includes(typeName);
}

function unwrapType(typeNode: FieldDefinitionNode["type"]): {
  name: string;
  list: boolean;
  required: boolean;
} {
  let node = typeNode;
  let list = false;
  let required = false;

  if (node.kind === "NonNullType") {
    required = true;
    node = node.type;
  }
  if (node.kind === "ListType") {
    list = true;
    node = node.type;
  }
  if (node.kind === "NonNullType") {
    node = node.type;
  }
  if (node.kind !== "NamedType") {
    throw new Error("Unsupported GraphQL type node");
  }

  return { name: node.name.value, list, required };
}

function collectObjectTypes(doc: DocumentNode): ObjectTypeDefinitionNode[] {
  return doc.definitions.filter(
    (def): def is ObjectTypeDefinitionNode =>
      def.kind === "ObjectTypeDefinition" && !ROOT_TYPES.has(def.name.value),
  );
}

function meshFieldName(fieldName: string): string {
  return fieldName;
}

/** Convert GraphQL SDL into a MeshQL schema config and migration report. */
export function convertGraphqlSdl(sdl: string): GraphqlSdlResult {
  const doc = parse(sdl);
  const report: CodemodReport = {
    converted: [],
    manual: [],
    skipped: [],
  };

  const entities: Record<string, EntityConfig> = {};
  const joins: Record<string, JoinConfig> = {};

  for (const type of collectObjectTypes(doc)) {
    const key = entityKey(type.name.value);
    const scalarFields: string[] = [];

    for (const field of type.fields ?? []) {
      const { name, list } = unwrapType(field.type);
      const fieldName = meshFieldName(field.name.value);

      if (isScalarGraphQLType(name)) {
        scalarFields.push(fieldName);
        continue;
      }

      const joinKey = `${key}.${fieldName}`;
      joins[joinKey] = {
        entity: entityKey(name),
        type: list ? "many" : "one",
        on: `/* TODO: SQL join ${joinKey} */ 1=1`,
      };
      report.manual.push(`Join '${joinKey}' needs a real SQL \`on\` clause`);
    }

    entities[key] = {
      type: {},
      fields: scalarFields,
      table: `${key}s`,
    };
    report.converted.push(`type ${type.name.value} → entities.${key}`);
  }

  const schema: MeshSchema = { entities, joins };
  const resolverStubs = renderResolverStubs(Object.keys(entities));

  if (Object.keys(joins).length > 0) {
    report.manual.push("Review generated join SQL — GraphQL relations do not map 1:1 to SQL");
  }

  return { schema, report, resolverStubs };
}

function renderResolverStubs(entityKeys: string[]): string {
  const lines = entityKeys.map(
    (entity) =>
      `mesh.resolve("${entity}", async (plan) => {\n  // TODO: implement resolver for ${entity}\n  throw new Error("Not implemented");\n});`,
  );
  return lines.join("\n\n");
}

/** Serialize a MeshSchema as TypeScript source for paste-in migration. */
export function renderMeshSchema(schema: MeshSchema): string {
  return `export const schema = ${JSON.stringify(schema, null, 2)} as const;\n`;
}

export type { MeshSchema };
