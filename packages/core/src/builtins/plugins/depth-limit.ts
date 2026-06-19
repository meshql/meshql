import type { ASTNode } from "../../parser/ast.js";
import { collectAstNodes } from "../../planner/join-plan.js";
import { ValidationError } from "../../errors/index.js";
import type { MeshPlugin } from "../../plugin/types.js";

/** Options for query depth limiting. */
export interface DepthLimitOptions {
  max: number;
}

function astDepth(node: ASTNode): number {
  if (node.refs.length === 0) {
    return 1;
  }
  return 1 + Math.max(...node.refs.map(astDepth));
}

/** Create a plugin that rejects queries exceeding a maximum nesting depth. */
export function depthLimit(options: DepthLimitOptions): MeshPlugin {
  return {
    name: "depth-limit",

    onPlan(plan, ctx) {
      const ast = ctx.ast;
      if (!ast) {
        return plan;
      }

      const nodes = collectAstNodes(ast.root);
      const maxDepth = Math.max(...nodes.map(astDepth));

      if (maxDepth > options.max) {
        throw new ValidationError(
          `Query depth ${maxDepth} exceeds maximum of ${options.max}`,
        );
      }

      return plan;
    },
  };
}
