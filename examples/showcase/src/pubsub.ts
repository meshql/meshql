import { InMemoryPubSubStore } from "@meshql/pubsub";

/** Shared pub/sub for SSE subscriptions in the showcase demo. */
export const pubsub = new InMemoryPubSubStore();
