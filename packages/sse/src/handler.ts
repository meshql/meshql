import type { MeshInstance } from "@meshql/core";
import { TransportError } from "@meshql/core";
import {
  handleGet,
  toErrorResponse,
  type DecodeQueryOptions,
  type HttpRequest,
} from "@meshql/http";
import { entityRecordChannel, type PubSubStore } from "@meshql/pubsub";

/** Writable SSE stream surface (Express, Fastify, Node HTTP). */
export interface SseWritable {
  write(chunk: string): void;
  end(): void;
  onClose(callback: () => void): void;
}

/** Options for {@link handleMeshSse}. */
export interface MeshSseOptions {
  pubsub: PubSubStore;
  resolveQueryId?: DecodeQueryOptions["resolveQueryId"];
  /** Heartbeat comment interval in ms. Default 30_000. */
  heartbeatMs?: number;
}

export function formatSseEvent(input: {
  event?: string;
  data: unknown;
  id?: string;
}): string {
  let chunk = "";
  if (input.event) {
    chunk += `event: ${input.event}\n`;
  }
  if (input.id) {
    chunk += `id: ${input.id}\n`;
  }
  chunk += `data: ${JSON.stringify(input.data)}\n\n`;
  return chunk;
}

/**
 * Stream field-shaped updates for one entity record over Server-Sent Events.
 * Re-runs the same MeshQL selection as a GET when pub/sub notifications arrive.
 */
export async function handleMeshSse(
  mesh: MeshInstance,
  req: HttpRequest,
  writable: SseWritable,
  options: MeshSseOptions,
): Promise<void> {
  const entity = req.params.entity;
  const entityId = req.params.id;

  if (!entity || !entityId) {
    throw new TransportError("SSE requires GET /:entity/:id/events");
  }

  const channel = entityRecordChannel(entity, entityId);
  const decodeOptions: DecodeQueryOptions = {
    resolveQueryId: options.resolveQueryId,
  };

  const pushSnapshot = async () => {
    try {
      const body = await handleGet(mesh, req, decodeOptions);
      writable.write(formatSseEvent({ event: "update", data: body }));
    } catch (error) {
      const mapped = toErrorResponse(error);
      writable.write(
        formatSseEvent({ event: "error", data: mapped.body }),
      );
    }
  };

  await pushSnapshot();

  const subscription = options.pubsub.subscribe(channel, () => {
    void pushSnapshot();
  });

  const heartbeatMs = options.heartbeatMs ?? 30_000;
  const heartbeat = setInterval(() => {
    writable.write(": heartbeat\n\n");
  }, heartbeatMs);

  writable.onClose(() => {
    clearInterval(heartbeat);
    void Promise.resolve(subscription.unsubscribe());
  });
}

export type { MeshSseOptions as SseHandlerOptions };
