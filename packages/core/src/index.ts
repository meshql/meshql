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

export interface ExecuteOptions {
  format?: "json" | "ql";
  context?: Partial<QueryContext> & Pick<QueryContext, "requestId" | "method">;
  list?: boolean;
}

export interface MeshInstance {
  schema: MeshConfig;
  resolve(entity: string, resolver: Resolver): MeshInstance;
  resolveUpload(path: string, resolver: UploadResolver): MeshInstance;
  execute(
    query: string,
    options?: ExecuteOptions,
  ): Promise<Record<string, unknown> | Record<string, unknown>[]>;
}

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
