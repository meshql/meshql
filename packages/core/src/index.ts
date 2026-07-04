/**
 * MeshQL core: define schemas, register resolvers, and execute shaped queries.
 *
 * @module
 */
import { MeshError, ResolverError, ValidationError } from "./errors/index.js";
import { parseQuery } from "./parser/index.js";
import { buildJoinPlan } from "./planner/join-plan.js";
import type { ListOptions } from "./planner/list-options.js";
import { validateAst } from "./planner/validator.js";
import type { MeshConfig } from "./schema/schema.js";
import {
  createQueryContext,
  ResolverRegistry,
  type MeshFile,
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
import { entityIdField, resolveEntityKey } from "./schema/schema.js";

/** Options passed to {@link MeshInstance.execute}. */
export interface ExecuteOptions {
  /** Query wire format. Defaults to `ql`. */
  format?: "json" | "ql";
  /** Request context passed to resolvers. */
  context?: Partial<QueryContext> & Pick<QueryContext, "requestId" | "method">;
  /** Return a list of shaped records instead of a single object. */
  list?: boolean;
  /**
   * Pagination, filtering, and ordering options attached to the plan.
   *
   * Precedence: this option overrides any `$list` declared in the wire
   * payload. Setting it implicitly enables list-shape mode (`list: true`);
   * pass `list: false` explicitly to opt back into single-record shaping.
   *
   * For HTTP transport, prefer declaring `$list` in the JSON wire payload
   * so the value is covered by the request signature. This option exists
   * for programmatic callers and adapters that construct plans directly.
   */
  listOptions?: ListOptions;
  /** HTTP transport metadata for integrity verification. */
  transport?: ExecuteTransport;
}

/** Options for {@link MeshInstance.executeUpload}. */
export interface ExecuteUploadOptions {
  /** Entity receiving the upload (e.g. `"user"`). */
  entity: string;
  /** Field on the entity (e.g. `"avatar"`). Resolver key is `entity.field`. */
  field: string;
  /** Uploaded file bytes and metadata. */
  file: MeshFile;
  /** Primary key when attaching to an existing record. */
  entityId?: string;
  /**
   * Signed wire payload (decoded `X-Mesh-Query`). Must include
   * `contentHash` when integrity is enabled.
   */
  query: string;
  /** HTTP transport metadata for integrity verification. */
  transport?: ExecuteTransport;
  /** Extra context fields (e.g. metadata from a multipart `meta` part). */
  context?: Partial<QueryContext> & Pick<QueryContext, "requestId" | "method">;
}

/** Extract `contentHash` from an upload wire payload without full AST parse. */
export function extractContentHash(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const hash = parsed.contentHash;
    return typeof hash === "string" && hash.length > 0 ? hash : undefined;
  } catch {
    return undefined;
  }
}

/** A configured MeshQL server instance with registered resolvers. */
export interface MeshInstance {
  schema: MeshConfig;
  /** Register a data resolver for an entity. */
  resolve(entity: string, resolver: Resolver): MeshInstance;
  /**
   * Register a file upload resolver for a path (`"user.avatar"`).
   */
  resolveUpload(path: string, resolver: UploadResolver): MeshInstance;
  /** Register a plugin hook. */
  use(plugin: MeshPlugin): MeshInstance;
  /** Parse, plan, fetch, and shape a MeshQL query. */
  execute(
    query: string,
    options?: ExecuteOptions,
  ): Promise<Record<string, unknown> | Record<string, unknown>[]>;
  /** Handle a multipart file upload for an entity field. */
  executeUpload(
    options: ExecuteUploadOptions,
  ): Promise<Record<string, unknown>>;
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

        // Resolve list options: explicit caller override wins over the
        // wire-declared `$list`, which wins over none. listOptions presence
        // implies list-shape mode unless the caller passed `list: false`.
        const listOptions = options.listOptions ?? ast.list;
        const listMode = options.list ?? listOptions !== undefined;

        const plan = buildJoinPlan(ast, config, context, {
          list: listOptions,
        });

        const planResult = await plugins.runOnPlan(plan, pluginCtx);

        if (isPlanShortCircuit(planResult)) {
          let shortResponse = planResult.response;
          if (!listMode && Array.isArray(shortResponse) && shortResponse.length === 0) {
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

        const shaped = listMode
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

    async executeUpload(options) {
      const startTime = Date.now();
      const uploadKey = `${options.entity}.${options.field}`;
      const context = createQueryContext(
        options.context ?? {
          requestId: crypto.randomUUID(),
          method: "POST",
          entity: options.entity,
          entityId: options.entityId,
        },
      );
      context.entity = options.entity;
      if (options.entityId !== undefined) {
        context.entityId = options.entityId;
      }

      const pluginCtx: PluginContext & { contentHash?: string } = {
        queryContext: context,
        transport: options.transport,
        startTime,
        contentHash: extractContentHash(options.query),
      };

      try {
        await plugins.runOnRequest(options.query, pluginCtx);

        const entityKey = resolveEntityKey(options.entity, config);
        if (!entityKey) {
          throw new ValidationError(`Unknown entity '${options.entity}'`);
        }

        const entityConfig = config.entities[entityKey];
        const plan = {
          rootEntity: entityKey,
          fields: [options.field],
          idField: entityIdField(entityConfig),
          joins: [],
          context,
        };

        const file = await plugins.runOnUpload(options.file, plan, pluginCtx);

        const uploadResolver = registry.getUpload(uploadKey);
        if (!uploadResolver) {
          throw new ResolverError(
            `No upload resolver registered for '${uploadKey}'`,
            options.entity,
          );
        }

        let result: Record<string, unknown>;
        try {
          result = await uploadResolver(file, plan);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          throw new ResolverError(message, options.entity);
        }

        result = (await plugins.runOnResult(result, pluginCtx)) as Record<
          string,
          unknown
        >;
        return (await plugins.runOnResponse(result, pluginCtx)) as Record<
          string,
          unknown
        >;
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
export type {
  BuildJoinPlanOptions,
  JoinPlan,
  ResolvedJoin,
} from "./planner/join-plan.js";
export {
  stripFieldsFromPlan,
  normalizeFieldPath,
  isFieldDenied,
} from "./planner/strip-fields.js";
export { validateAst } from "./planner/validator.js";
export {
  DEFAULT_LIST_LIMIT,
  FILTER_OPS,
  MAX_LIST_LIMIT,
  isFilterOp,
} from "./planner/list-options.js";
export type { Filter, FilterOp, ListOptions, OrderBy } from "./planner/list-options.js";
export {
  entityTable,
  entityIdField,
  resolveEntityKey,
  type MeshConfig,
  type MeshSchema,
  type EntityConfig,
  type JoinConfig,
} from "./schema/schema.js";
export { shape, shapeMany } from "./shaper/shaper.js";
export {
  CATCH_ALL,
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
