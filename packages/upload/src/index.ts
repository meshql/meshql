/**
 * Optional file upload extension for MeshQL servers.
 *
 * @example
 * ```ts
 * import { createMesh } from "@meshql/core";
 * import { withUpload } from "@meshql/upload";
 *
 * const mesh = withUpload(createMesh({ entities: {} }), {
 *   storage: "local",
 *   localDirectory: "./uploads",
 * });
 * ```
 */
import type { MeshInstance } from "@meshql/core";
import { createLocalStorage } from "./storage/local.js";
import { createR2Storage } from "./storage/r2.js";
import { createS3Storage, type S3StorageOptions } from "./storage/s3.js";
import type { StorageAdapter } from "./storage/types.js";

/** Built-in storage backends supported by {@link withUpload}. */
export type StorageKind = "local" | "s3" | "r2";

/** Options for enabling uploads on a MeshQL instance. */
export interface UploadOptions {
  storage: StorageKind | StorageAdapter;
  /** Max upload size (e.g. `"25mb"`). Default `25mb`. */
  maxSize?: string;
  /** Allowed MIME types; omit to allow any. */
  allowed?: string[];
  localDirectory?: string;
  /** S3 options when `storage` is `"s3"`. */
  s3?: S3StorageOptions;
  /** R2 options when `storage` is `"r2"`. */
  r2?: {
    accountId: string;
    bucket: string;
    credentials?: S3StorageOptions["credentials"];
    endpoint?: string;
  };
}

/** Resolved upload configuration attached to a MeshQL instance. */
export interface UploadConfig extends UploadOptions {
  adapter: StorageAdapter;
  maxBytes: number;
}

/** Parse a size string like `"25mb"` into bytes. */
export function parseSize(value: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid size '${value}'`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? "b").toLowerCase();
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  return Math.floor(amount * (multipliers[unit] ?? 1));
}

function createAdapter(options: UploadOptions): StorageAdapter {
  if (typeof options.storage !== "string") {
    return options.storage;
  }

  switch (options.storage) {
    case "local":
      return createLocalStorage({
        directory: options.localDirectory ?? "./uploads",
      });
    case "s3":
      if (!options.s3?.bucket) {
        throw new Error('storage: "s3" requires options.s3.bucket');
      }
      return createS3Storage(options.s3);
    case "r2":
      if (!options.r2?.bucket || !options.r2.accountId) {
        throw new Error('storage: "r2" requires options.r2.accountId and options.r2.bucket');
      }
      return createR2Storage(options.r2);
    default:
      throw new Error(`Unknown storage kind '${options.storage as string}'`);
  }
}

/** Attach upload handling to a MeshQL instance. */
export function withUpload(
  mesh: MeshInstance,
  options: UploadOptions,
): MeshInstance & { upload: UploadConfig } {
  const adapter = createAdapter(options);
  const maxBytes = parseSize(options.maxSize ?? "25mb");

  return Object.assign(mesh, {
    upload: {
      ...options,
      adapter,
      maxBytes,
    },
  });
}

export { createLocalStorage } from "./storage/local.js";
export { createS3Storage } from "./storage/s3.js";
export { createR2Storage } from "./storage/r2.js";
export type { StorageAdapter } from "./storage/types.js";
export type { LocalStorageOptions } from "./storage/local.js";
export type { S3StorageOptions } from "./storage/s3.js";
export type { R2StorageOptions } from "./storage/r2.js";
