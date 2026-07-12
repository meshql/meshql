import type { Pool, PoolClient } from "pg";
import { decodePubSubWire, encodePubSubWire } from "./serialize.js";
import type {
  PubSubHandler,
  PubSubPayload,
  PubSubStore,
  PubSubSubscription,
} from "./store.js";

/** Options for {@link PostgresPubSubStore}. */
export interface PostgresPubSubOptions {
  pool: Pool;
}

function quoteListenChannel(channel: string): string {
  return `"${channel.replace(/"/g, '""')}"`;
}

/** Postgres LISTEN/NOTIFY pub/sub — no extra infra when you already use Postgres. */
export class PostgresPubSubStore implements PubSubStore {
  private readonly handlers = new Map<string, Set<PubSubHandler>>();
  private readonly listened = new Set<string>();
  private listener: PoolClient | null = null;
  private listenerReady: Promise<void> | null = null;

  constructor(private readonly options: PostgresPubSubOptions) {}

  private async ensureListener(): Promise<PoolClient> {
    if (this.listener) {
      return this.listener;
    }

    if (!this.listenerReady) {
      this.listenerReady = (async () => {
        this.listener = await this.options.pool.connect();
        this.listener.on("notification", (message) => {
          if (!message.channel) {
            return;
          }

          const channelHandlers = this.handlers.get(message.channel);
          if (!channelHandlers || !message.payload) {
            return;
          }

          const decoded = decodePubSubWire(message.channel, message.payload);
          for (const handler of channelHandlers) {
            void Promise.resolve(handler(decoded)).catch((error) => {
              console.error(
                `[meshql/pubsub] handler error on ${message.channel}:`,
                error,
              );
            });
          }
        });

        this.listener.on("error", (error) => {
          console.error("[meshql/pubsub] postgres listener error:", error);
        });
      })();
    }

    await this.listenerReady;
    return this.listener!;
  }

  async publish(channel: string, payload: PubSubPayload): Promise<void> {
    await this.options.pool.query("SELECT pg_notify($1, $2)", [
      channel,
      encodePubSubWire(channel, payload),
    ]);
  }

  subscribe(channel: string, handler: PubSubHandler): PubSubSubscription {
    let handlers = this.handlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(channel, handlers);
    }

    handlers.add(handler);
    void this.ensureListen(channel);

    return {
      unsubscribe: () => {
        handlers!.delete(handler);
        if (handlers!.size === 0) {
          this.handlers.delete(channel);
          void this.ensureUnlisten(channel);
        }
      },
    };
  }

  private async ensureListen(channel: string): Promise<void> {
    if (this.listened.has(channel)) {
      return;
    }

    const client = await this.ensureListener();
    await client.query(`LISTEN ${quoteListenChannel(channel)}`);
    this.listened.add(channel);
  }

  private async ensureUnlisten(channel: string): Promise<void> {
    if (this.handlers.has(channel) || !this.listened.has(channel)) {
      return;
    }

    const client = await this.ensureListener();
    await client.query(`UNLISTEN ${quoteListenChannel(channel)}`);
    this.listened.delete(channel);
  }

  /** Release the dedicated LISTEN connection. */
  async close(): Promise<void> {
    if (!this.listener) {
      return;
    }

    this.listener.release();
    this.listener = null;
    this.listenerReady = null;
    this.listened.clear();
  }
}

export function createPostgresPubSubStore(
  options: PostgresPubSubOptions,
): PostgresPubSubStore {
  return new PostgresPubSubStore(options);
}
