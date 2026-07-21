import type {
  AggregateSpec,
  HavingExpr,
  PageInput,
  SortExpr,
  WhereExpr,
} from "@meshql/core";

export type ReadSelection = Record<string, true | ReadNode>;

export interface ReadNode {
  $select: ReadSelection;
  $where?: WhereExpr;
  $orderBy?: SortExpr[];
  $page?: PageInput;
  $groupBy?: string[];
  $aggregate?: Record<string, AggregateSpec>;
  $having?: HavingExpr;
  $distinct?: string[];
}

/** A canonical JSON query with exactly one root entity at runtime. */
export type MeshQuery = Record<string, ReadNode>;

/** Serialize a canonical MeshQL JSON query without rewriting it. */
export function queryToJson(query: MeshQuery): string {
  if (Object.keys(query).length !== 1) {
    throw new Error("MeshQL query must have exactly one root entity");
  }
  return JSON.stringify(query);
}
