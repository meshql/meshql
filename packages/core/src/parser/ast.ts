import type { ListOptions } from "../planner/list-options.js";

/** A node in a parsed MeshQL query tree. */
export interface ASTNode {
  name: string;
  fields: string[];
  refs: ASTNode[];
}

/** Root abstract syntax tree for a MeshQL query. */
export interface AST {
  root: ASTNode;
  /**
   * List-read options declared in the wire payload (JSON `$list` key).
   * Populated by {@link parseJson} when present; always undefined for `parseQl`
   * because the brace grammar has no list syntax.
   *
   * Callers that pass `listOptions` explicitly to `mesh.execute` take
   * precedence over anything parsed here.
   */
  list?: ListOptions;
}
