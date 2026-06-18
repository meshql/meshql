/** A node in a parsed MeshQL query tree. */
export interface ASTNode {
  name: string;
  fields: string[];
  refs: ASTNode[];
}

/** Root abstract syntax tree for a MeshQL query. */
export interface AST {
  root: ASTNode;
}
