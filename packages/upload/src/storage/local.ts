import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MeshFile } from "@meshql/core";
import type { StorageAdapter } from "./types.js";

/** Options for the local filesystem storage adapter. */
export interface LocalStorageOptions {
  directory: string;
}

function resolveKeyPath(directory: string, key: string): string {
  const normalized = key.replace(/^\/+/, "").replace(/\.\./g, "");
  const full = path.resolve(directory, normalized);
  const root = path.resolve(directory);
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error(`Invalid storage key '${key}'`);
  }
  return full;
}

/** Create a local filesystem storage adapter. */
export function createLocalStorage(options: LocalStorageOptions): StorageAdapter {
  const directory = path.resolve(options.directory);

  return {
    async put(file: MeshFile, key: string) {
      const filePath = resolveKeyPath(directory, key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, file.buffer);
      return key.replace(/^\/+/, "");
    },

    async get(key: string) {
      const filePath = resolveKeyPath(directory, key);
      return readFile(filePath);
    },

    async delete(key: string) {
      const filePath = resolveKeyPath(directory, key);
      await unlink(filePath);
    },
  };
}
