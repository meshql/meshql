import type { PubSubStore } from "./store.js";
import { entityRecordChannel } from "./channels.js";

/** Publish a record update hint on the MeshQL channel for an entity id. */
export function notifyEntityUpdate(
  pubsub: PubSubStore,
  entity: string,
  id: string | number,
  payload: unknown = { type: "updated" },
): void {
  void Promise.resolve(
    pubsub.publish(entityRecordChannel(entity, id), payload),
  );
}
