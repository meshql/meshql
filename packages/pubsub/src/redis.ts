import { createClient, type RedisClientType } from "redis";
import { decodePubSubWire, encodePubSubWire } from "./serialize.js";
import type {
  PubSubHandler,
  PubSubPayload,
  PubSubStore,
  PubSubSubscription,
} from "./store.js";

/** Options for {@link RedisPubSubStore}. */
export interface RedisPubSubOptions {
  url: string;
}

/** Redis pub/sub for multi-node production deployments. */
export class RedisPubSubStore implements PubSubStore {
  private readonly publisher: RedisClientType;
  private readonly subscriber: RedisClientType;
  private readonly ready: Promise<void>;
  private readonly handlers = new Map<string, Set<PubSubHandler>>();
  private readonly subscribed = new Set<string>();

  constructor(options: RedisPubSubOptions) {
    this.publisher = createClient({ url: options.url });
    this.subscriber = this.publisher.duplicate();
    this.ready = this.connect();
  }

  private async connect(): Promise<void> {
    this.publisher.on("error", (error) => {
      console.error("[meshql/pubsub] redis publisher error:", error);
    });
    this.subscriber.on("error", (error) => {
      console.error("[meshql/pubsub] redis subscriber error:", error);
    });

    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
  }

  async publish(channel: string, payload: PubSubPayload): Promise<void> {
    await this.ready;
    await this.publisher.publish(channel, encodePubSubWire(channel, payload));
  }

  subscribe(channel: string, handler: PubSubHandler): PubSubSubscription {
    let handlers = this.handlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(channel, handlers);
    }

    handlers.add(handler);
    void this.ready.then(() => this.ensureSubscribed(channel));

    return {
      unsubscribe: () => {
        handlers!.delete(handler);
        if (handlers!.size === 0) {
          this.handlers.delete(channel);
          void this.ready.then(() => this.maybeUnsubscribe(channel));
        }
      },
    };
  }

  private async ensureSubscribed(channel: string): Promise<void> {
    if (this.subscribed.has(channel)) {
      return;
    }

    this.subscribed.add(channel);
    await this.subscriber.subscribe(channel, (raw) => {
      const message = decodePubSubWire(channel, raw);
      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers) {
        return;
      }

      for (const channelHandler of channelHandlers) {
        void Promise.resolve(channelHandler(message)).catch((error) => {
          console.error(`[meshql/pubsub] handler error on ${channel}:`, error);
        });
      }
    });
  }

  private async maybeUnsubscribe(channel: string): Promise<void> {
    if (this.handlers.has(channel)) {
      return;
    }

    this.subscribed.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  /** Close Redis connections. */
  async close(): Promise<void> {
    await this.ready;
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }
}

export function createRedisPubSubStore(
  options: RedisPubSubOptions,
): RedisPubSubStore {
  return new RedisPubSubStore(options);
}
