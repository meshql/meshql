import type {
  PubSubHandler,
  PubSubMessage,
  PubSubPayload,
  PubSubStore,
  PubSubSubscription,
} from "./store.js";

/** In-process pub/sub for development and single-node deployments. */
export class InMemoryPubSubStore implements PubSubStore {
  private subscribers = new Map<string, Set<PubSubHandler>>();

  publish(channel: string, payload: PubSubPayload): void {
    const handlers = this.subscribers.get(channel);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const message: PubSubMessage = {
      channel,
      payload,
      publishedAt: Date.now(),
    };

    for (const handler of handlers) {
      void Promise.resolve(handler(message)).catch((error) => {
        console.error(`[meshql/pubsub] handler error on ${channel}:`, error);
      });
    }
  }

  subscribe(channel: string, handler: PubSubHandler): PubSubSubscription {
    let handlers = this.subscribers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.subscribers.set(channel, handlers);
    }

    handlers.add(handler);

    return {
      unsubscribe: () => {
        handlers!.delete(handler);
        if (handlers!.size === 0) {
          this.subscribers.delete(channel);
        }
      },
    };
  }

  /** Test helper — number of active handlers on a channel. */
  subscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size ?? 0;
  }
}
