import {
  AGGREGATE_FNS,
  COMPARISON_OPS,
  DEFAULT_PAGE_FIRST,
  MAX_PAGE_FIRST,
  type MeshConfig,
} from "@meshql/core";

/** Field entry in schema introspection output. */
export interface SchemaFieldDoc {
  name: string;
  kind: "scalar" | "computed";
  /** Present when a computed field declares `type` for docs. */
  type?: "string" | "number" | "boolean";
}

/** Join entry exposed in the playground entity browser. */
export interface SchemaJoinDoc {
  /** Ref name in queries (e.g. `posts` in `{ user { posts { id } } }`). */
  name: string;
  entity: string;
  type: "one" | "many";
}

/** Entity entry in schema introspection output. */
export interface SchemaEntityDoc {
  name: string;
  fields: SchemaFieldDoc[];
  joins: SchemaJoinDoc[];
  listCapable: boolean;
}

/** Query features understood by the current MeshQL JSON protocol. */
export interface SchemaQueryCapabilities {
  formats: Array<"json" | "ql">;
  controls: string[];
  filterOperators: string[];
  aggregateFunctions: string[];
  pagination: {
    style: "keyset";
    defaultFirst: number;
    maxFirst: number;
  };
}

/** JSON schema document served at `GET /docs/schema`. */
export interface SchemaDoc {
  title?: string;
  query: SchemaQueryCapabilities;
  entities: SchemaEntityDoc[];
}

export interface BuildSchemaDocOptions {
  title?: string;
  /** Hide entities not in this list. */
  entities?: string[];
}

/** Build playground introspection JSON from a MeshQL schema. */
export function buildSchemaDoc(
  schema: MeshConfig,
  options: BuildSchemaDocOptions = {},
): SchemaDoc {
  const allowlist = options.entities
    ? new Set(options.entities)
    : undefined;

  const entities: SchemaEntityDoc[] = [];

  for (const [name, entity] of Object.entries(schema.entities)) {
    if (allowlist && !allowlist.has(name)) {
      continue;
    }

    const computed = entity.computed ?? {};
    const fields: SchemaFieldDoc[] = [
      ...entity.fields.map((fieldName) => ({
        name: fieldName,
        kind: "scalar" as const,
      })),
      ...Object.keys(computed).map((fieldName) => ({
        name: fieldName,
        kind: "computed" as const,
        ...(computed[fieldName]?.type
          ? { type: computed[fieldName]!.type }
          : {}),
      })),
    ];

    const joins: SchemaJoinDoc[] = [];
    const prefix = `${name}.`;
    for (const [joinKey, join] of Object.entries(schema.joins ?? {})) {
      if (!joinKey.startsWith(prefix)) {
        continue;
      }
      const refName = joinKey.slice(prefix.length);
      joins.push({
        name: refName,
        entity: join.entity,
        type: join.type,
      });
    }

    joins.sort((a, b) => a.name.localeCompare(b.name));

    entities.push({
      name,
      fields,
      joins,
      listCapable: true,
    });
  }

  entities.sort((a, b) => a.name.localeCompare(b.name));

  return {
    title: options.title,
    query: {
      formats: ["json", "ql"],
      controls: [
        "$select",
        "$where",
        "$orderBy",
        "$page",
        "$groupBy",
        "$aggregate",
        "$having",
        "$distinct",
      ],
      filterOperators: [...COMPARISON_OPS],
      aggregateFunctions: [...AGGREGATE_FNS],
      pagination: {
        style: "keyset",
        defaultFirst: DEFAULT_PAGE_FIRST,
        maxFirst: MAX_PAGE_FIRST,
      },
    },
    entities,
  };
}
