export interface ASTNode {
  name: string;
  fields: string[];
  refs: ASTNode[];
}

export interface AST {
  root: ASTNode;
}
