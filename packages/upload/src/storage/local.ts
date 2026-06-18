import type { MeshFile } from "@meshql/core";

/** Storage backend used to persist uploaded files. */
export interface StorageAdapter {
  put(file: MeshFile, key: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Options for the local filesystem storage adapter. */
export interface LocalStorageOptions {
  directory: string;
}

/** Create a local filesystem storage adapter. */
export function createLocalStorage(_options: LocalStorageOptions): StorageAdapter {
  return {
    async put(file, key) {
      return `file://${key}`;
    },
    async get(_key) {
      return Buffer.from([]);
    },
    async delete(_key) {
      return;
    },
  };
}
