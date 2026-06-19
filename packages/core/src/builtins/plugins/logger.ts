import type { MeshPlugin, PluginContext } from "../../plugin/types.js";
import type { JoinPlan } from "../../planner/join-plan.js";

/** Options for the logger plugin. */
export interface LoggerOptions {
  onRequest?: (ctx: PluginContext, plan: JoinPlan) => void;
  onError?: (ctx: PluginContext, err: Error) => void;
  onResponse?: (ctx: PluginContext, ms: number) => void;
}

/** Create a logging plugin for request lifecycle events. */
export function logger(options: LoggerOptions): MeshPlugin {
  return {
    name: "logger",

    onPlan(plan, ctx) {
      options.onRequest?.(ctx, plan);
      return plan;
    },

    onError(error, ctx) {
      options.onError?.(ctx, error);
    },

    onResponse(_response, ctx) {
      const ms = Date.now() - ctx.startTime;
      options.onResponse?.(ctx, ms);
    },
  };
}
