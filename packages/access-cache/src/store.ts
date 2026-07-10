/** Cached permission payload stored in {@link AccessCacheStore}. */
export type AccessCacheValue = boolean | string[];

/** Key-value store for serialized access cache entries. */
export interface AccessCacheStore {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, ttlSeconds: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  deleteByPrefix(prefix: string): Promise<number> | number;
}

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

/** In-memory access cache (single-process, dev-friendly). */
export class InMemoryAccessCacheStore implements AccessCacheStore {
  private entries = new Map<string, MemoryEntry>();

  get(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  deleteByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      this.entries.delete(key);
      removed += 1;
    }
    return removed;
  }
}

export function serializeCacheValue(value: AccessCacheValue): string {
  return JSON.stringify({ v: value });
}

export function deserializeCacheValue(raw: string): AccessCacheValue | null {
  try {
    const parsed = JSON.parse(raw) as { v?: AccessCacheValue };
    if (typeof parsed.v === "boolean" || Array.isArray(parsed.v)) {
      return parsed.v;
    }
    return null;
  } catch {
    return null;
  }
}

async function readStoreValue(
  store: AccessCacheStore,
  key: string,
): Promise<AccessCacheValue | null> {
  const raw = await store.get(key);
  if (raw === null) {
    return null;
  }
  return deserializeCacheValue(raw);
}

async function writeStoreValue(
  store: AccessCacheStore,
  key: string,
  value: AccessCacheValue,
  ttlSeconds: number,
): Promise<void> {
  await store.set(key, serializeCacheValue(value), ttlSeconds);
}

export async function readBoolean(
  store: AccessCacheStore,
  key: string,
): Promise<boolean | null> {
  const value = await readStoreValue(store, key);
  return typeof value === "boolean" ? value : null;
}

export async function writeBoolean(
  store: AccessCacheStore,
  key: string,
  value: boolean,
  ttlSeconds: number,
): Promise<void> {
  await writeStoreValue(store, key, value, ttlSeconds);
}

export async function readStringList(
  store: AccessCacheStore,
  key: string,
): Promise<string[] | null> {
  const value = await readStoreValue(store, key);
  return Array.isArray(value) ? value : null;
}

export async function writeStringList(
  store: AccessCacheStore,
  key: string,
  value: string[],
  ttlSeconds: number,
): Promise<void> {
  await writeStoreValue(store, key, value, ttlSeconds);
}
