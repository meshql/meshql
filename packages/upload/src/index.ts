/**
 * Optional file upload extension for MeshQL servers.
 *
 * @module
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
import { createLocalStorage, type StorageAdapter } from "./storage/local.js";

/** Built-in storage backends supported by {@link withUpload}. */
export type StorageKind = "local" | "s3" | "r2";

/** Options for enabling uploads on a MeshQL instance. */
export interface UploadOptions {
  storage: StorageKind | StorageAdapter;
  maxSize?: string;
  allowed?: string[];
  localDirectory?: string;
}

/** Resolved upload configuration attached to a MeshQL instance. */
export interface UploadConfig extends UploadOptions {
  adapter: StorageAdapter;
}

/** Attach upload handling to a MeshQL instance. */
export function withUpload(mesh: MeshInstance, options: UploadOptions): MeshInstance & {
  upload: UploadConfig;
} {
  const adapter =
    typeof options.storage === "string"
      ? createLocalStorage({
          directory: options.localDirectory ?? "./uploads",
        })
      : options.storage;

  return Object.assign(mesh, {
    upload: {
      ...options,
      adapter,
    },
  });
}

export { createLocalStorage } from "./storage/local.js";
export type { StorageAdapter } from "./storage/local.js";
