/**
 * MeshQL core: define schemas, register resolvers, and execute shaped queries.
 *
 * @module
 *
 * @example
 * ```ts
 * import { buildSelectSql, createMesh } from "@meshql/core";
 *
 * const mesh = createMesh({
 *   entities: {
 *     user: {
 *       table: "users",
 *       joins: { tokens: { table: "tokens", on: "user_id" } },
 *     },
 *   },
 * });
 *
 * mesh.resolve("user", async (plan) => {
 *   const sql = buildSelectSql(plan, mesh.schema);
 *   return db.query(sql.text, sql.params);
 * });
 *
 * const user = await mesh.execute("user { id email tokens { accessToken } }", {
 *   context: { requestId: "req-1", method: "GET" },
 * });
 * ```
 */
import { ResolverError } from "./errors/index.js";
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

/** Options passed to {@link MeshInstance.execute}. */
export interface ExecuteOptions {
  /** Query wire format. Defaults to `ql`. */
  format?: "json" | "ql";
  /** Request context passed to resolvers. */
  context?: Partial<QueryContext> & Pick<QueryContext, "requestId" | "method">;
  /** Return a list of shaped records instead of a single object. */
  list?: boolean;
}

/** A configured MeshQL server instance with registered resolvers. */
export interface MeshInstance {
  schema: MeshConfig;
  /** Register a data resolver for an entity. */
  resolve(entity: string, resolver: Resolver): MeshInstance;
  /** Register a file upload resolver for a path. */
  resolveUpload(path: string, resolver: UploadResolver): MeshInstance;
  /** Parse, plan, fetch, and shape a MeshQL query. */
  execute(
    query: string,
    options?: ExecuteOptions,
  ): Promise<Record<string, unknown> | Record<string, unknown>[]>;
}

/** Create a MeshQL instance from a schema configuration. */
export function createMesh(config: MeshConfig): MeshInstance {
  const registry = new ResolverRegistry();

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

    async execute(query, options = {}) {
      const format = options.format ?? "ql";
      const context = createQueryContext(
        options.context ?? {
          requestId: crypto.randomUUID(),
          method: "GET",
        },
      );

      const ast: AST = parseQuery(query, format);
      validateAst(ast, config);
      const plan = buildJoinPlan(ast, config, context);

      const resolver = registry.get(plan.rootEntity);
      if (!resolver) {
        throw new ResolverError(
          `No resolver registered for entity '${plan.rootEntity}'`,
          plan.rootEntity,
        );
      }

      let raw: unknown;
      try {
        raw = await resolver(plan);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Resolver failed";
        throw new ResolverError(message, plan.rootEntity);
      }

      const rows = Array.isArray(raw)
        ? raw
        : [raw as Record<string, unknown>];

      return options.list
        ? shapeMany(rows, ast.root, plan.joins)
        : shape(rows, ast.root, plan.joins);
    },
  };

  return mesh;
}

export { MeshError, ParseError, ResolverError, TransportError, ValidationError } from "./errors/index.js";
export { parseQuery, parseQl, parseJson, tokenize } from "./parser/index.js";
export type { AST, ASTNode } from "./parser/ast.js";
export { buildJoinPlan } from "./planner/join-plan.js";
export type { JoinPlan, ResolvedJoin } from "./planner/join-plan.js";
export { validateAst } from "./planner/validator.js";
export {
  entityTable,
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
