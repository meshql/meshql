import { collectAstNodes } from "../../planner/join-plan.js";
import { ValidationError } from "../../errors/index.js";
import type { MeshPlugin } from "../../plugin/types.js";

/** Options for query complexity scoring. */
export interface ComplexityLimitOptions {
  max: number;
  fieldCost?: number;
  joinCost?: number;
}

/** Create a plugin that rejects queries exceeding a complexity budget. */
export function complexityLimit(options: ComplexityLimitOptions): MeshPlugin {
  const fieldCost = options.fieldCost ?? 1;
  const joinCost = options.joinCost ?? 10;

  return {
    name: "complexity-limit",

    onPlan(plan, ctx) {
      const ast = ctx.ast;
      if (!ast) {
        return plan;
      }

      const nodes = collectAstNodes(ast.root);
      let score = 0;

      for (const node of nodes) {
        score += node.fields.length * fieldCost;
        score += node.refs.length * joinCost;
      }

      if (score > options.max) {
        throw new ValidationError(
          `Query complexity ${score} exceeds maximum of ${options.max}`,
        );
      }

      return plan;
    },
  };
}
