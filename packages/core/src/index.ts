/**
 * MeshQL core: define schemas, register resolvers, and execute shaped queries.
 *
 * @module
 */
import { MeshError, ResolverError, ValidationError } from "./errors/index.js";
import { parseQuery } from "./parser/index.js";
import { validateAst } from "./planner/validator.js";
import type { MeshConfig } from "./schema/schema.js";
import {
  createQueryContext,
  ResolverRegistry,
  type MeshFile,
  type QueryContext,
  type Resolver,
  type ResolverOptions,
  type UploadResolver,
} from "./resolver/index.js";
import type { CollectionResult } from "./query/types.js";
import { runMeshExecute } from "./execute/run.js";
import type { ExecuteDetailedResult, ExecuteMeta } from "./execute/run.js";
import type { ExecuteOptions } from "./execute/options.js";
export type { ExecuteOptions, ExecuteTraceOptions } from "./execute/options.js";
export type { ExecuteDetailedResult, ExecuteMeta } from "./execute/run.js";
import {
  PluginRunner,
  type ExecuteTransport,
  type MeshPlugin,
  type PluginContext,
  isPlanShortCircuit,
} from "./plugin/index.js";
import { entityIdField, resolveEntityKey } from "./schema/schema.js";
import { warnAmbiguousEntityTables } from "./schema/entity-table-warnings.js";
import { validateComputedFields } from "./schema/validate-computed.js";

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
  resolve(
    entity: string,
    resolver: Resolver,
    options?: ResolverOptions,
  ): MeshInstance;
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
  ): Promise<
    | Record<string, unknown>
    | CollectionResult<Record<string, unknown>>
    | null
  >;
  /**
   * Like {@link MeshInstance.execute} but returns timing, plan summary,
   * and optional SQL trace entries.
   */
  executeDetailed(
    query: string,
    options?: ExecuteOptions,
  ): Promise<ExecuteDetailedResult>;
  /** Handle a multipart file upload for an entity field. */
  executeUpload(
    options: ExecuteUploadOptions,
  ): Promise<Record<string, unknown>>;
}

/** Create a MeshQL instance from a schema configuration. */
export function createMesh(config: MeshConfig): MeshInstance {
  warnAmbiguousEntityTables(config);
  validateComputedFields(config);
  const registry = new ResolverRegistry();
  const plugins = new PluginRunner();

  const mesh: MeshInstance = {
    schema: config,

    resolve(entity, resolver, options = {}) {
      registry.register(entity, resolver, options);
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
      const { data } = await runMeshExecute(config, registry, plugins, query, options);
      return data;
    },

    executeDetailed(query, options = {}) {
      return runMeshExecute(config, registry, plugins, query, options);
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
export { parseQuery, parseQl, tokenize } from "./parser/index.js";
export type { AST, ASTNode } from "./parser/ast.js";
export {
  buildJoinPlan,
  collectAstNodes,
  joinPathAlias,
  parseQualifiedPlanField,
  qualifiedJoinField,
  rowAliasForQualifiedField,
} from "./planner/join-plan.js";
export type {
  BuildJoinPlanOptions,
  JoinPlan,
  ResolvedJoin,
} from "./planner/join-plan.js";
export {
  buildPathToSqlAlias,
  joinsInDependencyOrder,
  physicalTableForJoin,
  resolvePlanField,
  rewriteJoinOn,
  rowAliasForPlanField,
  sqlAliasForJoinPath,
} from "./planner/sql-from-plan.js";
export {
  stripFieldsFromPlan,
  normalizeFieldPath,
  isFieldDenied,
} from "./planner/strip-fields.js";
export { validateAst } from "./planner/validator.js";
export {
  buildPlanRelationTree,
  buildOrmListQuery,
  buildOrmPointRead,
  mapEntityField,
  type OrmFilter,
  type OrmListQuery,
  type PlanRelationTree,
  type RelationNode,
} from "./orm/plan-relations.js";
export { decodeCursor, encodeCursor, type CursorPayload } from "./planner/cursor.js";
export {
  parseJsonQuery,
  normalizeReadTree,
  astNodeToWire,
  readNodeAt,
  queryScopeFingerprint,
  toCollectionResult,
  emptyPageInfo,
  encodeReadCursor,
  decodeReadCursor,
  assertCursorMatchesRead,
  buildCursorFromRow,
  normalizeOrderForCursor,
  renderWhereSql,
  renderReadWhereSql,
  renderCursorPredicateSql,
  QUERY_PROTOCOL_VERSION,
  COMPARISON_OPS,
  AGGREGATE_FNS,
  DEFAULT_PAGE_FIRST,
  MAX_PAGE_FIRST,
} from "./query/index.js";
export type {
  WhereExpr,
  SortExpr,
  PageInput,
  AggregateSpec,
  ReadNodeWire,
  NormalizedReadNode,
  CollectionResult,
  PageInfo,
  QueryDocument,
  ExecuteResult,
} from "./query/types.js";
export type { ReadCursorPayload } from "./query/read-cursor.js";
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
  entityQueryableFields,
  isComputedField,
  resolveEntityKey,
  type MeshConfig,
  type MeshSchema,
  type EntityConfig,
  type ComputedFieldDef,
  type JoinConfig,
} from "./schema/schema.js";
export { validateComputedFields } from "./schema/validate-computed.js";
export {
  injectComputedIntoFlatRows,
  applyComputedToPreshaped,
} from "./computed/apply.js";
export type { PlanComputedField } from "./computed/types.js";
export {
  extendSchema,
  type MeshSchemaOverride,
} from "./schema/extend-schema.js";
export { shape, shapeMany } from "./shaper/shaper.js";
export {
  CATCH_ALL,
  createQueryContext,
  ResolverRegistry,
  type QueryContext,
  type Resolver,
  type ResolverOptions,
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
export {
  createSqlTraceCollector,
  recordPlanSql,
  type SqlTraceCollector,
  type SqlTraceEntry,
} from "./trace/sql-trace.js";
export {
  summarizeJoinPlan,
  type JoinPlanSummary,
} from "./trace/join-plan-summary.js";
