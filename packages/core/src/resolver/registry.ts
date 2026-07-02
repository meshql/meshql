import type { JoinPlan } from "../planner/join-plan.js";

/** Wildcard entity name used to register a catch-all resolver. */
export const CATCH_ALL: "*" = "*";

/**
 * Resolver function that fetches data for an entity join plan.
 *
 * @example List read with filters and ordering
 * ```ts
 * mesh.resolve("user", async (plan) => {
 *   const { sql, params } = buildSelectSql(plan, schema);
 *   // plan.list?.limit, plan.list?.filter, plan.list?.orderBy, plan.list?.cursor
 *   return db.query(sql, params);
 * });
 * ```
 */
export type Resolver<T = Record<string, unknown>> = (
  plan: JoinPlan,
) => Promise<T | T[]>;

/** Resolver function that handles an uploaded file for a join plan. */
export type UploadResolver<T = Record<string, unknown>> = (
  file: MeshFile,
  plan: JoinPlan,
) => Promise<T>;

/** Uploaded file metadata passed to upload resolvers. */
export interface MeshFile {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  size: number;
}

/**
 * Registry of entity and upload resolvers for a MeshQL instance.
 *
 * Entity resolvers are keyed by name. In addition, a single catch-all
 * resolver may be registered under the wildcard {@link CATCH_ALL} (`"*"`)
 * key. {@link get} returns the specific resolver when one exists and falls
 * back to the catch-all otherwise. This is the mechanism ORM adapters use
 * to serve every declared entity from a single generic handler.
 */
export class ResolverRegistry {
  private readonly resolvers = new Map<string, Resolver>();
  private readonly uploadResolvers = new Map<string, UploadResolver>();
  private catchAll: Resolver | undefined;

  /**
   * Register a resolver for an entity name, or the wildcard `"*"` for a
   * catch-all fallback.
   *
   * Registering the same specific entity twice silently replaces the
   * previous handler (useful during dev/HMR). Registering `"*"` twice
   * throws — catch-all ordering must be deterministic for adapter
   * composition.
   */
  register(entity: string, resolver: Resolver): void {
    if (entity === CATCH_ALL) {
      if (this.catchAll !== undefined) {
        throw new Error(
          "A catch-all resolver ('*') is already registered. Only one is allowed per mesh.",
        );
      }
      this.catchAll = resolver;
      return;
    }
    this.resolvers.set(entity, resolver);
  }

  /** Register an upload handler for a URL path. */
  registerUpload(path: string, resolver: UploadResolver): void {
    this.uploadResolvers.set(path, resolver);
  }

  /**
   * Get the resolver registered for an entity.
   *
   * Returns the specific resolver when present; otherwise falls back to the
   * catch-all resolver if one was registered; otherwise `undefined`.
   */
  get(entity: string): Resolver | undefined {
    return this.resolvers.get(entity) ?? this.catchAll;
  }

  /** Get the upload resolver registered for a path. */
  getUpload(path: string): UploadResolver | undefined {
    return this.uploadResolvers.get(path);
  }

  /**
   * Check whether any resolver would fire for an entity.
   *
   * Returns `true` when a specific handler is registered, or when a
   * catch-all is registered and would serve as the fallback.
   */
  has(entity: string): boolean {
    return this.resolvers.has(entity) || this.catchAll !== undefined;
  }

  /** Check whether a catch-all resolver is registered. */
  hasCatchAll(): boolean {
    return this.catchAll !== undefined;
  }
}
