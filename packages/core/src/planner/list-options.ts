/**
 * List query options attached to a {@link JoinPlan} when the request is a
 * list read (no primary-key selector, or an explicit list intent).
 *
 * The HTTP transport carries these in the signed JSON wire payload as a
 * `$list` key alongside the field selection; resolvers translate them into
 * their database's native pagination/filter idiom.
 */
export interface ListOptions {
  /**
   * Maximum rows to return.
   *
   * Defaults to {@link DEFAULT_LIST_LIMIT} and is capped at
   * {@link MAX_LIST_LIMIT} by the HTTP boundary. Resolvers may cap further
   * but must not exceed the value they receive.
   */
  limit?: number;
  /**
   * Opaque cursor for keyset pagination. The value is transport-defined
   * (`base64url(JSON.stringify(...))` in the reference Postgres/SQLite
   * builders) and always encoded/decoded through the helpers exported from
   * the DB adapter.
   */
  cursor?: string;
  /** Multi-key ordering. Order matters: leftmost keys sort first. */
  orderBy?: OrderBy[];
  /**
   * Structured predicate list. Multiple filters combine with `AND`.
   * Compound `OR` is not supported at this layer — resolvers that need it
   * can consume the raw HTTP request via {@link JoinPlan.context}.
   */
  filter?: Filter[];
}

/** A single sort key. */
export interface OrderBy {
  field: string;
  dir: "asc" | "desc";
}

/**
 * Filter operators understood by the built-in HTTP parser and reference
 * SQL builders. Resolvers are free to accept a subset.
 */
export type FilterOp =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "like"
  | "ilike";

/** A single structured predicate. */
export interface Filter {
  field: string;
  op: FilterOp;
  /**
   * Filter value. Scalars for comparison operators, arrays for `in`/`nin`,
   * strings for `like`/`ilike`. Callers are responsible for shape; the
   * validator only checks the field name against the schema.
   */
  value: unknown;
}

/** Default limit when the caller omits `?limit`. */
export const DEFAULT_LIST_LIMIT = 50;

/** Hard cap enforced at the HTTP boundary regardless of `?limit`. */
export const MAX_LIST_LIMIT = 200;

/** All filter operators as a runtime-usable set for validation. */
export const FILTER_OPS: readonly FilterOp[] = [
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
] as const;

/** Runtime type guard for {@link FilterOp}. */
export function isFilterOp(value: string): value is FilterOp {
  return (FILTER_OPS as readonly string[]).includes(value);
}
