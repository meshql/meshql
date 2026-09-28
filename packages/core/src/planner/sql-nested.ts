import type { JoinPlan, ResolvedJoin } from "./join-plan.js";
import { parseQualifiedPlanField } from "./join-plan.js";
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./list-options.js";
import {
  buildPathToSqlAlias,
  junctionAliasForJoinPath,
  parentEntityForJoin,
  physicalTableForJoin,
  rewriteJoinOn,
  sqlTableRef,
} from "./sql-from-plan.js";
import { renderReadWhereSql } from "../query/cursor-sql.js";
import { groupKeyAlias, groupKeyBucket, groupKeyField } from "../query/group-keys.js";
import { readNodeAt } from "../query/normalize.js";
import {
  GROUP_ITEMS_KEY,
  type DateBucket,
  type GroupByKey,
  type NormalizedReadNode,
  type SortExpr,
} from "../query/types.js";
import { renderWhereSql, type SqlDialect } from "../query/where-sql.js";
import type { MeshSchema } from "../schema/schema.js";
import {
  entityPhysicalIdColumn,
  entityTable,
  hasThroughJoin,
} from "../schema/schema.js";

/** Parameterized SQL produced by {@link buildNestedSelectSql}. */
export interface NestedSqlQuery {
  sql: string;
  params: unknown[];
}

/** Options for {@link buildNestedSelectSql}. */
export interface NestedSqlOptions {
  idColumn?: string;
  /**
   * Emit `ORDER BY` inside JSON aggregate calls (default `true`). SQLite
   * older than 3.44 rejects that syntax; with `false` the renderer relies on
   * the ordered derived tables instead, which SQLite honors in practice but
   * does not guarantee.
   */
  aggregateOrderBy?: boolean;
}

/** SQL expression for a date bucket, rendered as an ISO-8601 prefix string. */
export function renderBucketSql(
  dialect: SqlDialect,
  bucket: DateBucket,
  expr: string,
): string {
  if (dialect === "postgres") {
    const format: Record<DateBucket, string> = {
      hour: `'YYYY-MM-DD"T"HH24:00'`,
      day: `'YYYY-MM-DD'`,
      week: `'YYYY-MM-DD'`,
      month: `'YYYY-MM'`,
      year: `'YYYY'`,
    };
    return `to_char(date_trunc('${bucket}', ${expr}), ${format[bucket]})`;
  }
  switch (bucket) {
    case "hour":
      return `strftime('%Y-%m-%dT%H:00', ${expr})`;
    case "day":
      return `strftime('%Y-%m-%d', ${expr})`;
    case "week":
      // Monday of the ISO week.
      return `date(${expr}, 'weekday 0', '-6 days')`;
    case "month":
      return `strftime('%Y-%m', ${expr})`;
    case "year":
      return `strftime('%Y', ${expr})`;
  }
}

function sqlColumn(entityKey: string, field: string, schema: MeshSchema): string {
  return schema.entities[entityKey]?.columns?.[field] ?? field;
}

/** SQL expression for a `$groupBy` key against `tableRef`. */
export function renderGroupKeySql(
  key: GroupByKey,
  tableRef: string,
  entityKey: string,
  schema: MeshSchema,
  dialect: SqlDialect,
): string {
  const column = `${tableRef}.${sqlColumn(entityKey, groupKeyField(key), schema)}`;
  const bucket = groupKeyBucket(key);
  return bucket ? renderBucketSql(dialect, bucket, column) : column;
}

/**
 * ORDER BY for a root aggregate read. Sort fields that name a group key
 * (by alias or source field) sort by the group expression, so bucketed and
 * renamed keys order correctly.
 */
export function renderAggregateOrderBySql(
  read: NormalizedReadNode,
  tableRef: string,
  entityKey: string,
  schema: MeshSchema,
  dialect: SqlDialect,
): string {
  const groupBy = read.groupBy ?? [];
  return read.orderBy
    .filter((entry): entry is Extract<SortExpr, { field: string }> => "field" in entry)
    .map((entry) => {
      const key =
        groupBy.find((candidate) => groupKeyAlias(candidate) === entry.field) ??
        groupBy.find((candidate) => groupKeyField(candidate) === entry.field);
      const expr = key
        ? renderGroupKeySql(key, tableRef, entityKey, schema, dialect)
        : `${tableRef}.${sqlColumn(entityKey, entry.field, schema)}`;
      const dir = entry.direction === "desc" ? "DESC" : "ASC";
      if (dialect !== "postgres") return `${expr} ${dir}`;
      return `${expr} ${dir} ${entry.nulls === "first" ? "NULLS FIRST" : "NULLS LAST"}`;
    })
    .join(", ");
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Postgres caps function arguments at 100, i.e. 50 key/value pairs. */
const MAX_JSON_PAIRS = 50;

interface JsonDialect {
  name: SqlDialect;
  jsonObject(pairs: Array<[string, string]>): string;
  jsonArrayAgg(expr: string, orderBy: string | undefined): string;
  /** Wrap a subquery result so it nests as JSON rather than a string. */
  embedJson(expr: string): string;
  nulls: boolean;
}

function chunkPairs(pairs: Array<[string, string]>): Array<Array<[string, string]>> {
  const chunks: Array<Array<[string, string]>> = [];
  for (let i = 0; i < pairs.length; i += MAX_JSON_PAIRS) {
    chunks.push(pairs.slice(i, i + MAX_JSON_PAIRS));
  }
  return chunks.length > 0 ? chunks : [[]];
}

const POSTGRES_JSON: JsonDialect = {
  name: "postgres",
  jsonObject(pairs) {
    const render = (fn: string, chunk: Array<[string, string]>) =>
      `${fn}(${chunk.map(([key, expr]) => `${sqlStringLiteral(key)}, ${expr}`).join(", ")})`;
    const chunks = chunkPairs(pairs);
    if (chunks.length === 1) return render("json_build_object", chunks[0]!);
    return `(${chunks.map((chunk) => render("jsonb_build_object", chunk)).join(" || ")})::json`;
  },
  jsonArrayAgg(expr, orderBy) {
    return `coalesce(json_agg(${expr}${orderBy ? ` ORDER BY ${orderBy}` : ""}), '[]'::json)`;
  },
  embedJson(expr) {
    return expr;
  },
  nulls: true,
};

function sqliteJson(aggregateOrderBy: boolean): JsonDialect {
  return {
    name: "sqlite",
    jsonObject(pairs) {
      const render = (chunk: Array<[string, string]>) =>
        `json_object(${chunk.map(([key, expr]) => `${sqlStringLiteral(key)}, ${expr}`).join(", ")})`;
      return chunkPairs(pairs)
        .map(render)
        .reduce((acc, next) => `json_patch(${acc}, ${next})`);
    },
    jsonArrayAgg(expr, orderBy) {
      const order = aggregateOrderBy && orderBy ? ` ORDER BY ${orderBy}` : "";
      return `coalesce(json_group_array(${expr}${order}), '[]')`;
    },
    embedJson(expr) {
      return `json(${expr})`;
    },
    nulls: false,
  };
}

class NestedRenderer {
  private readonly params: unknown[] = [];
  private readonly pathToAlias: Map<string, string>;
  private readonly rootTable: string;

  constructor(
    private readonly plan: JoinPlan,
    private readonly schema: MeshSchema,
    private readonly json: JsonDialect,
    private readonly options: NestedSqlOptions,
  ) {
    this.pathToAlias = buildPathToSqlAlias(plan);
    const rootConfig = schema.entities[plan.rootEntity];
    if (!rootConfig) {
      throw new Error(`Unknown root entity '${plan.rootEntity}'`);
    }
    this.rootTable = entityTable(plan.rootEntity, rootConfig);
  }

  // Params are pushed while text is generated, in textual order, because
  // SQLite binds positional `?` placeholders left to right.
  private placeholder(value: unknown): string {
    this.params.push(value);
    return this.json.name === "postgres" ? `$${this.params.length}` : "?";
  }

  render(): NestedSqlQuery {
    const { plan, schema, rootTable } = this;
    const read = plan.read;

    const selectParts = this.rootFields().map(
      (field) =>
        `${rootTable}.${sqlColumn(plan.rootEntity, field, schema)} AS ${quoteIdent(field)}`,
    );
    for (const child of this.childJoins("")) {
      selectParts.push(`${this.renderRelation(child, rootTable)} AS ${quoteIdent(child.refName)}`);
    }

    let sql = `SELECT ${selectParts.join(", ")} FROM ${rootTable}`;

    const whereClauses: string[] = [];
    if (plan.context.entityId !== undefined) {
      const idColumn =
        this.options.idColumn ?? entityPhysicalIdColumn(schema.entities[plan.rootEntity]);
      whereClauses.push(`${rootTable}.${idColumn} = ${this.placeholder(plan.context.entityId)}`);
    } else {
      whereClauses.push(
        ...renderReadWhereSql(read, rootTable, plan.rootEntity, schema, this.params, this.json.name),
      );
    }
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    if (plan.context.entityId === undefined) {
      const order = this.renderOrderBy(read?.orderBy ?? [], rootTable, plan.rootEntity);
      if (order) sql += ` ORDER BY ${order}`;
      const requested = read?.page?.first ?? plan.list?.limit ?? DEFAULT_LIST_LIMIT;
      const capped = Math.min(requested, MAX_LIST_LIMIT);
      // One sentinel row tells the executor whether another page exists.
      sql += ` LIMIT ${this.placeholder(read?.page ? capped + 1 : capped)}`;
    }

    return { sql, params: this.params };
  }

  private rootFields(): string[] {
    const joinPaths = this.plan.joins.map((join) => join.path);
    const fields: string[] = [];
    for (const qualified of this.plan.fields) {
      const parsed = parseQualifiedPlanField(qualified, this.plan.rootEntity, joinPaths);
      if (parsed.joinPath === null && !fields.includes(parsed.column)) {
        fields.push(parsed.column);
      }
    }
    return fields;
  }

  private joinFields(join: ResolvedJoin): string[] {
    const prefix = `${join.path}.`;
    const fields: string[] = [];
    for (const qualified of join.fields) {
      const field = qualified.startsWith(prefix) ? qualified.slice(prefix.length) : qualified;
      if (!fields.includes(field)) fields.push(field);
    }
    return fields;
  }

  private childJoins(parentPath: string): ResolvedJoin[] {
    return this.plan.joins.filter((join) => {
      const dot = join.path.lastIndexOf(".");
      const parent = dot === -1 ? "" : join.path.slice(0, dot);
      return parent === parentPath;
    });
  }

  private renderOrderBy(orderBy: SortExpr[], tableRef: string, entityKey: string): string {
    return orderBy
      .filter((entry): entry is Extract<SortExpr, { field: string }> => "field" in entry)
      .map((entry) => {
        const dir = entry.direction === "desc" ? "DESC" : "ASC";
        const nulls = this.json.nulls
          ? entry.nulls === "first"
            ? " NULLS FIRST"
            : " NULLS LAST"
          : "";
        return `${tableRef}.${sqlColumn(entityKey, entry.field, this.schema)} ${dir}${nulls}`;
      })
      .join(", ");
  }

  /** JSON object for one record of `join`'s entity (fields plus nested relations). */
  private renderRecordObject(join: ResolvedJoin, alias: string): string {
    const pairs: Array<[string, string]> = this.joinFields(join).map((field) => [
      field,
      `${alias}.${sqlColumn(join.entity, field, this.schema)}`,
    ]);
    for (const child of this.childJoins(join.path)) {
      pairs.push([child.refName, this.json.embedJson(this.renderRelation(child, alias))]);
    }
    return this.json.jsonObject(pairs);
  }

  /** `FROM ... WHERE <correlation>` for a relation hop, without the WHERE keyword. */
  private renderSource(join: ResolvedJoin, alias: string, parentRef: string): {
    from: string;
    correlation: string;
  } {
    const joinConfig = this.schema.joins[join.joinKey];
    const table = physicalTableForJoin(join, this.schema);

    if (hasThroughJoin(joinConfig)) {
      const through = joinConfig.through;
      const juncAlias = junctionAliasForJoinPath(join.path);
      const parentEntity = parentEntityForJoin(join, this.plan);
      const parentIdCol = entityPhysicalIdColumn(this.schema.entities[parentEntity]);
      const childIdCol = entityPhysicalIdColumn(this.schema.entities[join.entity]);
      return {
        from:
          `${table} AS ${alias} JOIN ${sqlTableRef(through.table)} AS ${juncAlias}` +
          ` ON ${juncAlias}.${quoteIdent(through.to)} = ${alias}.${childIdCol}`,
        correlation: `${juncAlias}.${quoteIdent(through.from)} = ${parentRef}.${parentIdCol}`,
      };
    }

    return {
      from: `${table} AS ${alias}`,
      correlation: rewriteJoinOn(join.on, join, this.plan.joins, this.pathToAlias, this.schema),
    };
  }

  /** Correlated subquery returning the JSON value of relation `join`. */
  private renderRelation(join: ResolvedJoin, parentRef: string): string {
    const alias = this.pathToAlias.get(join.path)!;
    const read = this.plan.read ? readNodeAt(this.plan.read, join.path) : undefined;

    if (join.type === "one") {
      const object = this.renderRecordObject(join, alias);
      const { from, correlation } = this.renderSource(join, alias, parentRef);
      return `(SELECT ${object} FROM ${from} WHERE ${correlation} LIMIT 1)`;
    }

    if (read?.groupBy?.length) {
      return this.renderBuckets(join, read, alias, parentRef);
    }

    const recordOrder = this.renderOrderBy(read?.orderBy ?? [], alias, join.entity);
    const object = this.renderRecordObject(join, alias);
    const window = this.renderWindow(join, read, alias, parentRef, recordOrder);
    return `(SELECT ${this.json.jsonArrayAgg(object, recordOrder || undefined)} FROM (${window}) AS ${alias})`;
  }

  /** Per-parent record window: correlation, `$where`, order and `$page.first`. */
  private renderWindow(
    join: ResolvedJoin,
    read: NormalizedReadNode | undefined,
    alias: string,
    parentRef: string,
    recordOrder: string,
  ): string {
    const { from, correlation } = this.renderSource(join, alias, parentRef);
    const clauses = [correlation];
    if (read?.perParent && read.where) {
      clauses.push(
        renderWhereSql(read.where, alias, join.entity, this.schema, this.params, this.json.name),
      );
    }
    let sql = `SELECT ${alias}.* FROM ${from} WHERE ${clauses.join(" AND ")}`;
    if (recordOrder) sql += ` ORDER BY ${recordOrder}`;
    if (read?.perParent && read.page) {
      sql += ` LIMIT ${this.placeholder(Math.min(read.page.first, MAX_LIST_LIMIT))}`;
    }
    return sql;
  }

  /** Buckets of records: `[{ <group keys>, <aggregates>, items: [...] }]`. */
  private renderBuckets(
    join: ResolvedJoin,
    read: NormalizedReadNode,
    alias: string,
    parentRef: string,
  ): string {
    const groupAlias = `${alias}__g`;
    const keys = (read.groupBy ?? []).map((key) => {
      const field = groupKeyField(key);
      const sortEntry = read.orderBy.find(
        (entry) => "field" in entry && entry.field === field,
      );
      return {
        name: groupKeyAlias(key),
        expr: renderGroupKeySql(key, alias, join.entity, this.schema, this.json.name),
        direction: sortEntry?.direction === "desc" ? "DESC" : "ASC",
      };
    });
    const aggregates = Object.entries(read.aggregates ?? {}).map(([name, spec]) => {
      const fn = spec.fn.toUpperCase();
      const field = spec.field ?? "*";
      const expr =
        field === "*"
          ? `${fn}(*)`
          : `${fn}(${spec.distinct ? "DISTINCT " : ""}${alias}.${sqlColumn(join.entity, field, this.schema)})`;
      return { name, expr };
    });

    const recordOrder = this.renderOrderBy(read.orderBy, alias, join.entity);
    const items = this.json.jsonArrayAgg(
      this.renderRecordObject(join, alias),
      recordOrder || undefined,
    );
    const window = this.renderWindow(join, read, alias, parentRef, recordOrder);

    const innerSelect = [
      ...keys.map((key) => `${key.expr} AS ${quoteIdent(key.name)}`),
      ...aggregates.map((agg) => `${agg.expr} AS ${quoteIdent(agg.name)}`),
      `${items} AS ${quoteIdent(GROUP_ITEMS_KEY)}`,
    ];
    const groupOrder = keys
      .map((key) => `${groupAlias}.${quoteIdent(key.name)} ${key.direction}`)
      .join(", ");
    const inner =
      `SELECT ${innerSelect.join(", ")} FROM (${window}) AS ${alias}` +
      ` GROUP BY ${keys.map((key) => key.expr).join(", ")}` +
      ` ORDER BY ${keys.map((key) => `${key.expr} ${key.direction}`).join(", ")}`;

    const bucketObject = this.json.jsonObject([
      ...keys.map((key): [string, string] => [key.name, `${groupAlias}.${quoteIdent(key.name)}`]),
      ...aggregates.map((agg): [string, string] => [agg.name, `${groupAlias}.${quoteIdent(agg.name)}`]),
      [GROUP_ITEMS_KEY, this.json.embedJson(`${groupAlias}.${quoteIdent(GROUP_ITEMS_KEY)}`)],
    ]);
    return `(SELECT ${this.json.jsonArrayAgg(bucketObject, groupOrder)} FROM (${inner}) AS ${groupAlias})`;
  }
}

/**
 * Build one SELECT for a plan using the nested fetch strategy. Root rows
 * carry their selected fields plus one JSON column per relation; each
 * relation is a correlated subquery, so `$where` / `$orderBy` / `$page` /
 * `$groupBy` on a `many` relation apply per parent row.
 */
export function buildNestedSelectSql(
  plan: JoinPlan,
  schema: MeshSchema,
  dialect: SqlDialect,
  options: NestedSqlOptions = {},
): NestedSqlQuery {
  const json =
    dialect === "postgres" ? POSTGRES_JSON : sqliteJson(options.aggregateOrderBy ?? true);
  return new NestedRenderer(plan, schema, json, options).render();
}
