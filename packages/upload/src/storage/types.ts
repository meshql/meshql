import type { MeshFile } from "@meshql/core";

/** Storage backend used to persist uploaded files. */
export interface StorageAdapter {
  /** Write file bytes and return the canonical storage key. */
  put(file: MeshFile, key: string): Promise<string>;
  /** Read file bytes by key. */
  get(key: string): Promise<Buffer>;
  /** Delete a stored file. */
  delete(key: string): Promise<void>;
}
