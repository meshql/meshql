import type {
  AggregateSpec,
  PageInput,
  SortExpr,
  WhereExpr,
} from "@meshql/core";

export type ReadSelection = Record<string, boolean | ReadNode>;

export interface ReadNode {
  $select: ReadSelection;
  $where?: WhereExpr;
  $orderBy?: SortExpr[];
  $page?: PageInput;
  $groupBy?: string[];
  $aggregate?: Record<string, AggregateSpec>;
  $having?: WhereExpr;
  $distinct?: string[];
}

/** Serialize a read node using the current JSON query protocol. */
export function readNodeToJson(rootName: string, node: ReadNode): string {
  return JSON.stringify({ [rootName]: node });
}

/** Build a read node from a selection plus optional controls. */
export function buildReadNode(
  selection: ReadSelection,
  controls: Omit<ReadNode, "$select"> = {},
): ReadNode {
  return { $select: selection, ...controls };
}
