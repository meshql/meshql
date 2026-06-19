import type { MeshError } from "../errors/index.js";
import type { JoinPlan } from "../planner/join-plan.js";
import type {
  MeshPlugin,
  PlanShortCircuit,
  PluginContext,
} from "./types.js";
import { isPlanShortCircuit } from "./types.js";

export class PluginRunner {
  private plugins: MeshPlugin[] = [];

  register(plugin: MeshPlugin): void {
    this.plugins.push(plugin);
  }

  getPlugins(): readonly MeshPlugin[] {
    return this.plugins;
  }

  async runOnRequest(
    raw: string,
    ctx: PluginContext,
  ): Promise<string> {
    let result = raw;
    for (const plugin of this.plugins) {
      if (plugin.onRequest) {
        result = await plugin.onRequest(result, ctx);
      }
    }
    return result;
  }

  async runOnPlan(
    plan: JoinPlan,
    ctx: PluginContext,
  ): Promise<JoinPlan | PlanShortCircuit> {
    let result: JoinPlan | PlanShortCircuit = plan;
    for (const plugin of this.plugins) {
      if (plugin.onPlan) {
        const next = await plugin.onPlan(
          isPlanShortCircuit(result) ? plan : result,
          ctx,
        );
        if (isPlanShortCircuit(next)) {
          return next;
        }
        result = next;
      }
    }
    return result;
  }

  async runOnResult(result: unknown, ctx: PluginContext): Promise<unknown> {
    let current = result;
    for (let i = this.plugins.length - 1; i >= 0; i--) {
      const plugin = this.plugins[i];
      if (plugin?.onResult) {
        current = await plugin.onResult(current, ctx);
      }
    }
    return current;
  }

  async runOnResponse(
    response: unknown,
    ctx: PluginContext,
  ): Promise<unknown> {
    let current = response;
    for (let i = this.plugins.length - 1; i >= 0; i--) {
      const plugin = this.plugins[i];
      if (plugin?.onResponse) {
        current = await plugin.onResponse(current, ctx);
      }
    }
    return current;
  }

  async runOnError(error: MeshError, ctx: PluginContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onError) {
        await plugin.onError(error, ctx);
      }
    }
  }
}
