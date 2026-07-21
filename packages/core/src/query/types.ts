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

/** Parsed read node before schema normalization. */
export interface ReadNodeWire {
  name: string;
  select: Record<string, boolean | ReadNodeWire>;
  where?: WhereExpr;
  orderBy?: SortExpr[];
  page?: PageInput;
  distinct?: string[];
  groupBy?: string[];
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
  groupBy?: string[];
  aggregates?: Record<string, AggregateSpec>;
  having?: HavingExpr;
  mode: "record" | "aggregate";
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

export const DEFAULT_PAGE_FIRST = 50;
export const MAX_PAGE_FIRST = 200;
export const MAX_FILTER_DEPTH = 8;
export const MAX_FILTER_NODES = 64;
export const MAX_IN_SIZE = 200;
export const MAX_GROUP_KEYS = 8;
export const MAX_AGGREGATES = 16;
