import type { MeshInstance } from "@meshql/core";
import { createLocalStorage, type StorageAdapter } from "./storage/local.js";

export type StorageKind = "local" | "s3" | "r2";

export interface UploadOptions {
  storage: StorageKind | StorageAdapter;
  maxSize?: string;
  allowed?: string[];
  localDirectory?: string;
}

export interface UploadConfig extends UploadOptions {
  adapter: StorageAdapter;
}

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
