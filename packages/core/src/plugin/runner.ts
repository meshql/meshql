import type { MeshError } from "../errors/index.js";
import type { JoinPlan } from "../planner/join-plan.js";
import type { MeshPlugin, PlanShortCircuit, PluginContext } from "./types.js";
import { isPlanShortCircuit } from "./types.js";

/**
 * Runs the registered plugin lifecycle hooks.
 *
 * Ordering follows the Koa/Express "onion" model:
 *
 * - `onRequest` and `onPlan` run in **registration order** (outer → inner)
 *   so earlier plugins can transform input for later ones.
 * - `onResult` and `onResponse` run in **reverse registration order**
 *   (inner → outer) so the plugin that wrapped a value gets to unwrap it.
 * - `onError` notifies all plugins in registration order; failures inside
 *   error hooks are not caught here.
 */
export class PluginRunner {
  private plugins: MeshPlugin[] = [];

  register(plugin: MeshPlugin): void {
    this.plugins.push(plugin);
  }

  getPlugins(): readonly MeshPlugin[] {
    return this.plugins;
  }

  async runOnRequest(raw: string, ctx: PluginContext): Promise<string> {
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
    let result: JoinPlan = plan;
    for (const plugin of this.plugins) {
      if (!plugin.onPlan) continue;

      const next = await plugin.onPlan(result, ctx);
      if (isPlanShortCircuit(next)) {
        return next;
      }
      result = next;
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

  async runOnResponse(response: unknown, ctx: PluginContext): Promise<unknown> {
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
