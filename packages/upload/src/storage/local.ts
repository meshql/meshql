import type { MeshFile } from "@meshql/core";

export interface StorageAdapter {
  put(file: MeshFile, key: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export interface LocalStorageOptions {
  directory: string;
}

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
