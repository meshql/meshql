/**
 * MeshQL core: define schemas, register resolvers, and execute shaped queries.
 *
 * @module
 */
import { MeshError, ResolverError } from "./errors/index.js";
import { parseQuery } from "./parser/index.js";
import { buildJoinPlan } from "./planner/join-plan.js";
import { validateAst } from "./planner/validator.js";
import type { MeshConfig } from "./schema/schema.js";
import {
  createQueryContext,
  ResolverRegistry,
  type QueryContext,
  type Resolver,
  type UploadResolver,
} from "./resolver/index.js";
import { shape, shapeMany } from "./shaper/shaper.js";
import type { AST } from "./parser/ast.js";
import {
  PluginRunner,
  type ExecuteTransport,
  type MeshPlugin,
  type PluginContext,
  isPlanShortCircuit,
} from "./plugin/index.js";

/** Options passed to {@link MeshInstance.execute}. */
export interface ExecuteOptions {
  /** Query wire format. Defaults to `ql`. */
  format?: "json" | "ql";
  /** Request context passed to resolvers. */
  context?: Partial<QueryContext> & Pick<QueryContext, "requestId" | "method">;
  /** Return a list of shaped records instead of a single object. */
  list?: boolean;
  /** HTTP transport metadata for integrity verification. */
  transport?: ExecuteTransport;
}

/** A configured MeshQL server instance with registered resolvers. */
export interface MeshInstance {
  schema: MeshConfig;
  /** Register a data resolver for an entity. */
  resolve(entity: string, resolver: Resolver): MeshInstance;
  /** Register a file upload resolver for a path. */
  resolveUpload(path: string, resolver: UploadResolver): MeshInstance;
  /** Register a plugin hook. */
  use(plugin: MeshPlugin): MeshInstance;
  /** Parse, plan, fetch, and shape a MeshQL query. */
  execute(
    query: string,
    options?: ExecuteOptions,
  ): Promise<Record<string, unknown> | Record<string, unknown>[]>;
}

/** Create a MeshQL instance from a schema configuration. */
export function createMesh(config: MeshConfig): MeshInstance {
  const registry = new ResolverRegistry();
  const plugins = new PluginRunner();

  const mesh: MeshInstance = {
    schema: config,

    resolve(entity, resolver) {
      registry.register(entity, resolver);
      return mesh;
    },

    resolveUpload(path, resolver) {
      registry.registerUpload(path, resolver);
      return mesh;
    },

    use(plugin) {
      plugins.register(plugin);
      return mesh;
    },

    async execute(query, options = {}) {
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

        const ast: AST = parseQuery(rawQuery, format);
        pluginCtx.ast = ast;

        validateAst(ast, config);
        const plan = buildJoinPlan(ast, config, context);

        const planResult = await plugins.runOnPlan(plan, pluginCtx);

        if (isPlanShortCircuit(planResult)) {
          let shortResponse = planResult.response;
          if (
            !options.list &&
            Array.isArray(shortResponse) &&
            shortResponse.length === 0
          ) {
            shortResponse = {};
          }
          const finalResponse = await plugins.runOnResponse(shortResponse, pluginCtx);
          return finalResponse as Record<string, unknown> | Record<string, unknown>[];
        }

        const resolver = registry.get(planResult.rootEntity);
        if (!resolver) {
          throw new ResolverError(
            `No resolver registered for entity '${planResult.rootEntity}'`,
            planResult.rootEntity,
          );
        }

        let raw: unknown;
        try {
          raw = await resolver(planResult);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Resolver failed";
          throw new ResolverError(message, planResult.rootEntity);
        }

        raw = await plugins.runOnResult(raw, pluginCtx);

        const rows = Array.isArray(raw) ? raw : [raw as Record<string, unknown>];

        const shaped = options.list
          ? shapeMany(rows, ast.root, planResult.joins, planResult.idField)
          : shape(rows, ast.root, planResult.joins);

        const response = await plugins.runOnResponse(shaped, pluginCtx);
        return response as Record<string, unknown> | Record<string, unknown>[];
      } catch (error) {
        if (error instanceof MeshError) {
          await plugins.runOnError(error, pluginCtx);
        }
        throw error;
      }
    },
  };

  return mesh;
}

export {
  MeshError,
  ParseError,
  ResolverError,
  TransportError,
  ValidationError,
  IntegrityError,
  RateLimitError,
} from "./errors/index.js";
export { parseQuery, parseQl, parseJson, tokenize } from "./parser/index.js";
export type { AST, ASTNode } from "./parser/ast.js";
export { buildJoinPlan, collectAstNodes } from "./planner/join-plan.js";
export type { JoinPlan, ResolvedJoin } from "./planner/join-plan.js";
export {
  stripFieldsFromPlan,
  normalizeFieldPath,
  isFieldDenied,
} from "./planner/strip-fields.js";
export { validateAst } from "./planner/validator.js";
export {
  entityTable,
  entityIdField,
  type MeshConfig,
  type MeshSchema,
  type EntityConfig,
  type JoinConfig,
} from "./schema/schema.js";
export { buildSelectSql } from "./sql/builder.js";
export type { SqlBuilderOptions, SqlQuery } from "./sql/builder.js";
export { shape, shapeMany } from "./shaper/shaper.js";
export {
  createQueryContext,
  ResolverRegistry,
  type QueryContext,
  type Resolver,
  type UploadResolver,
  type MeshFile,
} from "./resolver/index.js";
export {
  PluginRunner,
  type ExecuteTransport,
  type MeshPlugin,
  type PlanShortCircuit,
  type PluginContext,
  isPlanShortCircuit,
} from "./plugin/index.js";
export {
  hmacSha256,
  formatSignature,
  parseSignature,
  signQueryHeader,
  verifyQuerySignature,
} from "./crypto/hmac.js";
