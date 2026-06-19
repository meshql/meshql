import type { MeshError } from "../errors/index.js";
import type { JoinPlan } from "../planner/join-plan.js";
import type { QueryContext } from "../resolver/context.js";

/** HTTP transport metadata for integrity verification. */
export interface ExecuteTransport {
  queryHeader: string;
  signature?: string;
  token?: string;
  headers?: Record<string, string>;
}

/** Plugin hook context passed through the execution pipeline. */
export interface PluginContext {
  queryContext: QueryContext;
  transport?: ExecuteTransport;
  ast?: import("../parser/ast.js").AST;
  startTime: number;
}

/** Composable plugin for extending the MeshQL execution pipeline. */
export interface MeshPlugin {
  name: string;

  onRequest?: (
    raw: string,
    ctx: PluginContext,
  ) => string | Promise<string>;

  onPlan?: (
    plan: JoinPlan,
    ctx: PluginContext,
  ) => JoinPlan | PlanShortCircuit | Promise<JoinPlan | PlanShortCircuit>;

  onResult?: (
    result: unknown,
    ctx: PluginContext,
  ) => unknown | Promise<unknown>;

  onResponse?: (
    response: unknown,
    ctx: PluginContext,
  ) => unknown | Promise<unknown>;

  onError?: (error: MeshError, ctx: PluginContext) => void | Promise<void>;
}

/** Result of a plan hook that short-circuits resolver execution. */
export interface PlanShortCircuit {
  shortCircuit: true;
  response: Record<string, unknown> | Record<string, unknown>[];
}

export function isPlanShortCircuit(
  value: JoinPlan | PlanShortCircuit,
): value is PlanShortCircuit {
  return (
    typeof value === "object" &&
    value !== null &&
    "shortCircuit" in value &&
    (value as PlanShortCircuit).shortCircuit === true
  );
}
