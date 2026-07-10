import type { AccessCacheStore } from "./store.js";

/** Upstash Redis REST credentials. */
export interface UpstashAccessCacheOptions {
  url: string;
  token: string;
}

interface UpstashResponse {
  result?: string | string[] | null;
}

/** Access cache backed by Upstash Redis REST (production / serverless). */
export class UpstashAccessCacheStore implements AccessCacheStore {
  constructor(private readonly options: UpstashAccessCacheOptions) {}

  private async command(args: string[]): Promise<UpstashResponse> {
    const response = await fetch(this.options.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Upstash request failed (${response.status})`);
    }

    return (await response.json()) as UpstashResponse;
  }

  async get(key: string): Promise<string | null> {
    const { result } = await this.command(["GET", key]);
    return typeof result === "string" ? result : null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.command(["SET", key, value, "EX", String(ttlSeconds)]);
  }

  async delete(key: string): Promise<void> {
    await this.command(["DEL", key]);
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const { result } = await this.command(["KEYS", `${prefix}*`]);
    const keys = Array.isArray(result) ? result : [];
    if (keys.length === 0) {
      return 0;
    }

    await this.command(["DEL", ...keys]);
    return keys.length;
  }
}

/** Generic Redis REST store (Upstash-compatible command API). */
export function createRedisAccessCacheStore(
  options: UpstashAccessCacheOptions,
): UpstashAccessCacheStore {
  return new UpstashAccessCacheStore(options);
}
