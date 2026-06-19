export type {
  MeshPlugin,
  PluginContext,
  ExecuteTransport,
  PlanShortCircuit,
  JoinPlan,
  QueryContext,
  MeshInstance,
} from "@meshql/core";

export { isPlanShortCircuit } from "@meshql/core";

/** Helper type for plugin authors building onPlan hooks. */
export interface PlanHookContext {
  plan: import("@meshql/core").JoinPlan;
  ctx: import("@meshql/core").PluginContext;
}
