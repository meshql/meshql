import {
  injectComputedIntoFlatRows,
  applyComputedToPreshaped,
} from "../computed/apply.js";
import { MeshError, ResolverError } from "../errors/index.js";
import { parseQuery } from "../parser/index.js";
import {
  parseJsonQuery,
  normalizeReadTree,
  astNodeToWire,
  toCollectionResult,
} from "../query/index.js";
import { QUERY_PROTOCOL_VERSION } from "../query/types.js";
import type { ReadNodeWire } from "../query/types.js";
import type { AST } from "../parser/ast.js";
import { buildJoinPlan } from "../planner/join-plan.js";
import type { JoinPlan } from "../planner/join-plan.js";
import { validateAst } from "../planner/validator.js";
import {
  isPlanShortCircuit,
  type PluginContext,
} from "../plugin/index.js";
import type { PluginRunner } from "../plugin/runner.js";
import type { MeshConfig } from "../schema/schema.js";
import { createQueryContext } from "../resolver/context.js";
import type { ResolverRegistry } from "../resolver/registry.js";
import { shape, shapeMany } from "../shaper/shaper.js";
import {
  summarizeJoinPlan,
  type JoinPlanSummary,
} from "../trace/join-plan-summary.js";
import {
  createSqlTraceCollector,
  type SqlTraceEntry,
} from "../trace/sql-trace.js";
import type { ExecuteOptions } from "./options.js";

/** Metadata returned by {@link MeshInstance.executeDetailed}. */
export interface ExecuteMeta {
  durationMs: number;
  plan: JoinPlanSummary;
  sql?: SqlTraceEntry[];
  version: typeof QUERY_PROTOCOL_VERSION;
}

/** Result of {@link MeshInstance.executeDetailed}. */
export interface ExecuteDetailedResult {
  data:
    | Record<string, unknown>
    | import("../query/types.js").CollectionResult<Record<string, unknown>>
    | null;
  meta: ExecuteMeta;
}

function buildMeta(plan: JoinPlan, startTime: number): ExecuteMeta {
  const meta: ExecuteMeta = {
    durationMs: Date.now() - startTime,
    plan: summarizeJoinPlan(plan),
    version: QUERY_PROTOCOL_VERSION,
  };
  if (plan.sqlTrace && plan.sqlTrace.entries.length > 0) {
    meta.sql = [...plan.sqlTrace.entries];
  }
  return meta;
}

async function shapeResponse(
  raw: unknown,
  listMode: boolean,
  ast: AST,
  plan: JoinPlan,
  schema: MeshConfig,
  preshaped: boolean,
  plugins: PluginRunner,
  pluginCtx: PluginContext,
): Promise<ExecuteDetailedResult> {
  const startTime = pluginCtx.startTime;

  let shaped: unknown;
  if (preshaped) {
    let response: unknown = raw;
    if (!listMode) {
      if (Array.isArray(raw)) {
        response = raw[0] ?? {};
      }
    } else if (!Array.isArray(raw)) {
      response = raw === null || raw === undefined ? [] : [raw];
    }

    shaped = applyComputedToPreshaped(
      response as Record<string, unknown> | Record<string, unknown>[],
      ast,
      plan,
      schema,
    );
  } else {
    const rows = Array.isArray(raw) ? raw : [raw as Record<string, unknown>];
    injectComputedIntoFlatRows(rows, plan, schema);
    shaped = listMode
      ? shapeMany(rows, ast.root, plan.joins, plan.idField)
      : shape(rows, ast.root, plan.joins);
  }

  const responseData = await plugins.runOnResponse(shaped, pluginCtx);

  let data: ExecuteDetailedResult["data"];
  if (listMode) {
    const items = Array.isArray(responseData)
      ? (responseData as Record<string, unknown>[])
      : responseData == null
        ? []
        : [responseData as Record<string, unknown>];
    data = toCollectionResult(items, plan.read);
  } else if (Array.isArray(responseData)) {
    data = (responseData[0] as Record<string, unknown>) ?? null;
  } else {
    data = (responseData as Record<string, unknown>) ?? null;
  }

  return {
    data,
    meta: buildMeta(plan, startTime),
  };
}

/**
 * Parse a raw query (JSON or QL) into a single normalized read tree.
 *
 * There is exactly one internal read model. JSON payloads carry the full
 * control surface (`$select`/`$where`/`$orderBy`/`$page`/aggregates); the QL
 * brace grammar is a selection-only encoding that normalizes into the same
 * tree with default controls.
 */
function toReadWire(raw: string, format: "json" | "ql"): ReadNodeWire {
  if (format === "json") {
    return parseJsonQuery(raw).root;
  }
  return astNodeToWire(parseQuery(raw).root);
}

/** Run the full MeshQL execution pipeline with optional trace metadata. */
export async function runMeshExecute(
  config: MeshConfig,
  registry: ResolverRegistry,
  plugins: PluginRunner,
  query: string,
  options: ExecuteOptions = {},
): Promise<ExecuteDetailedResult> {
  const format = options.format ?? "ql";
  const startTime = Date.now();
  const context = createQueryContext(
    options.context ?? {
      requestId: crypto.randomUUID(),
      method: "GET",
    },
  );

  const pluginCtx: PluginContext = {
    queryContext: context,
    transport: options.transport,
    startTime,
  };

  let rawQuery = query;

  try {
    rawQuery = await plugins.runOnRequest(rawQuery, pluginCtx);

    const wire = toReadWire(rawQuery, format);
    const normalized = normalizeReadTree(wire, config);
    const ast: AST = { root: normalized.ast.root, read: normalized.read };
    validateAst(ast, config);
    pluginCtx.ast = ast;

    const listMode = options.list ?? context.entityId === undefined;

    const plan = buildJoinPlan(ast, config, context, { read: ast.read });

    if (options.trace?.sql) {
      plan.sqlTrace = createSqlTraceCollector();
    }

    const planResult = await plugins.runOnPlan(plan, pluginCtx);
    pluginCtx.plan = isPlanShortCircuit(planResult) ? plan : planResult;

    if (isPlanShortCircuit(planResult)) {
      const shortResponse = planResult.response;
      return shapeResponse(
        shortResponse,
        listMode,
        ast,
        plan,
        config,
        true,
        plugins,
        pluginCtx,
      );
    }

    const resolverEntry = registry.getEntry(planResult.rootEntity);
    if (!resolverEntry) {
      throw new ResolverError(
        `No resolver registered for entity '${planResult.rootEntity}'`,
        planResult.rootEntity,
      );
    }

    let raw: unknown;
    try {
      raw = await resolverEntry.resolver(planResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resolver failed";
      throw new ResolverError(message, planResult.rootEntity);
    }

    raw = await plugins.runOnResult(raw, pluginCtx);

    return shapeResponse(
      raw,
      listMode,
      ast,
      planResult,
      config,
      resolverEntry.preshaped,
      plugins,
      pluginCtx,
    );
  } catch (error) {
    if (error instanceof MeshError) {
      await plugins.runOnError(error, pluginCtx);
    }
    throw error;
  }
}

export type { JoinPlanSummary, SqlTraceEntry };
