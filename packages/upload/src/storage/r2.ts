import { createS3Storage, type S3StorageOptions } from "./s3.js";
import type { StorageAdapter } from "./types.js";

/** Options for Cloudflare R2 (S3-compatible) storage. */
export interface R2StorageOptions extends Omit<S3StorageOptions, "endpoint" | "forcePathStyle"> {
  accountId: string;
  /** Override the default `https://<accountId>.r2.cloudflarestorage.com` endpoint. */
  endpoint?: string;
}

/** Create an R2 storage adapter by wrapping the S3 adapter. */
export function createR2Storage(options: R2StorageOptions): StorageAdapter {
  const { accountId, endpoint, ...rest } = options;
  return createS3Storage({
    ...rest,
    endpoint: endpoint ?? `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    region: rest.region ?? "auto",
  });
}
