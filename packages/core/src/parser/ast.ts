import type { NormalizedReadNode } from "../query/types.js";

/** A node in a parsed MeshQL query tree. */
export interface ASTNode {
  name: string;
  fields: string[];
  refs: ASTNode[];
}

/** Root abstract syntax tree for a MeshQL query. */
export interface AST {
  root: ASTNode;
  /** Normalized read controls (filtering, ordering, pagination, aggregates). */
  read?: NormalizedReadNode;
}
