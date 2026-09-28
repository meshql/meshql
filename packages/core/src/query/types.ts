/** MeshQL query protocol version. */
export const QUERY_PROTOCOL_VERSION = 2 as const;

export type JsonScalar = string | number | boolean | null;

export type ComparisonOp =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "like"
  | "ilike"
  | "isNull"
  | "isNotNull";

export type WhereExpr =
  | { and: WhereExpr[] }
  | { or: WhereExpr[] }
  | { not: WhereExpr }
  | { field: string; op: ComparisonOp; value?: JsonScalar | JsonScalar[] };

export type HavingExpr =
  | { and: HavingExpr[] }
  | { or: HavingExpr[] }
  | { not: HavingExpr }
  | { aggregate: string; op: ComparisonOp; value?: JsonScalar | JsonScalar[] }
  | { field: string; op: ComparisonOp; value?: JsonScalar | JsonScalar[] };

export type SortDirection = "asc" | "desc";
export type NullsPlacement = "first" | "last";

export type SortExpr =
  | { field: string; direction: SortDirection; nulls?: NullsPlacement }
  | { aggregate: string; direction: SortDirection; nulls?: NullsPlacement };

export interface PageInput {
  first?: number;
  after?: string | null;
}

export type AggregateFn = "count" | "sum" | "avg" | "min" | "max";

export interface AggregateSpec {
  fn: AggregateFn;
  field?: string | "*";
  distinct?: boolean;
}

/** Truncation unit for a date/time group key. */
export type DateBucket = "hour" | "day" | "week" | "month" | "year";

/**
 * A `$groupBy` key: a plain field name, or a field truncated to a date
 * bucket. `as` names the key in the response (defaults to `field`).
 */
export type GroupByKey =
  | string
  | { field: string; bucket?: DateBucket; as?: string };

/** Parsed read node before schema normalization. */
export interface ReadNodeWire {
  name: string;
  select: Record<string, boolean | ReadNodeWire>;
  where?: WhereExpr;
  orderBy?: SortExpr[];
  page?: PageInput;
  distinct?: string[];
  groupBy?: GroupByKey[];
  aggregates?: Record<string, AggregateSpec>;
  having?: HavingExpr;
}

/** Normalized read node attached to the execution plan. */
export interface NormalizedReadNode {
  name: string;
  entityKey: string;
  path: string;
  joinType?: "one" | "many";
  fields: string[];
  refs: NormalizedReadNode[];
  where?: WhereExpr;
  orderBy: SortExpr[];
  page?: { first: number; after?: string };
  distinct?: string[];
  groupBy?: GroupByKey[];
  aggregates?: Record<string, AggregateSpec>;
  having?: HavingExpr;
  mode: "record" | "aggregate";
  /**
   * True on a `many` relation whose client sent explicit `$where`,
   * `$orderBy`, `$page`, `$groupBy` or `$aggregate`. These controls apply
   * per parent row, which the flat join strategy cannot express.
   */
  perParent?: boolean;
}

export interface PageInfo {
  hasNextPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface CollectionResult<T> {
  items: T[];
  pageInfo: PageInfo;
}

/** Parsed JSON query document for the current MeshQL read protocol. */
export interface QueryDocument {
  version: typeof QUERY_PROTOCOL_VERSION;
  root: ReadNodeWire;
}

export interface ExecuteResult<T = Record<string, unknown>> {
  data: T | CollectionResult<T> | null;
  meta: { version: typeof QUERY_PROTOCOL_VERSION; durationMs: number };
}

export const COMPARISON_OPS: readonly ComparisonOp[] = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "nin",
  "like",
  "ilike",
  "isNull",
  "isNotNull",
] as const;

export const AGGREGATE_FNS: readonly AggregateFn[] = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
] as const;

export const DATE_BUCKETS: readonly DateBucket[] = [
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;

/** Key under which a bucketed relation nests the records of each group. */
export const GROUP_ITEMS_KEY = "items";

export const DEFAULT_PAGE_FIRST = 50;
export const MAX_PAGE_FIRST = 200;
export const MAX_FILTER_DEPTH = 8;
export const MAX_FILTER_NODES = 64;
export const MAX_IN_SIZE = 200;
export const MAX_GROUP_KEYS = 8;
export const MAX_AGGREGATES = 16;
