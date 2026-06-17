import type { JoinPlan } from "../planner/join-plan.js";

export type Resolver<T = Record<string, unknown>> = (
  plan: JoinPlan,
) => Promise<T | T[]>;

export type UploadResolver<T = Record<string, unknown>> = (
  file: MeshFile,
  plan: JoinPlan,
) => Promise<T>;

export interface MeshFile {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  size: number;
}

export class ResolverRegistry {
  private readonly resolvers = new Map<string, Resolver>();
  private readonly uploadResolvers = new Map<string, UploadResolver>();

  register(entity: string, resolver: Resolver): void {
    this.resolvers.set(entity, resolver);
  }

  registerUpload(path: string, resolver: UploadResolver): void {
    this.uploadResolvers.set(path, resolver);
  }

  get(entity: string): Resolver | undefined {
    return this.resolvers.get(entity);
  }

  getUpload(path: string): UploadResolver | undefined {
    return this.uploadResolvers.get(path);
  }

  has(entity: string): boolean {
    return this.resolvers.has(entity);
  }
}
