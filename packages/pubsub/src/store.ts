/** JSON-serializable pub/sub payload. */
export type PubSubPayload = unknown;

/** Event delivered to subscribers. */
export interface PubSubMessage {
  channel: string;
  payload: PubSubPayload;
  publishedAt: number;
}

export type PubSubHandler = (message: PubSubMessage) => void | Promise<void>;

/** Handle returned from {@link PubSubStore.subscribe}. */
export interface PubSubSubscription {
  unsubscribe(): void | Promise<void>;
}

/** Publish/subscribe backend used by `@meshql/sse` and server-side invalidation. */
export interface PubSubStore {
  publish(channel: string, payload: PubSubPayload): Promise<void> | void;
  subscribe(channel: string, handler: PubSubHandler): PubSubSubscription;
}
