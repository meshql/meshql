import type { JoinPlan } from "../planner/join-plan.js";

/** Resolver function that fetches data for an entity join plan. */
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

/** Registry of entity and upload resolvers for a MeshQL instance. */
export class ResolverRegistry {
  private readonly resolvers = new Map<string, Resolver>();
  private readonly uploadResolvers = new Map<string, UploadResolver>();

  /** Register a resolver for an entity name. */
  register(entity: string, resolver: Resolver): void {
    this.resolvers.set(entity, resolver);
  }

  /** Register an upload handler for a URL path. */
  registerUpload(path: string, resolver: UploadResolver): void {
    this.uploadResolvers.set(path, resolver);
  }

  /** Get the resolver registered for an entity. */
  get(entity: string): Resolver | undefined {
    return this.resolvers.get(entity);
  }

  /** Get the upload resolver registered for a path. */
  getUpload(path: string): UploadResolver | undefined {
    return this.uploadResolvers.get(path);
  }

  /** Check whether an entity resolver is registered. */
  has(entity: string): boolean {
    return this.resolvers.has(entity);
  }
}
