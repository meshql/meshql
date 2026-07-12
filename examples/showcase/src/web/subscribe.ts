import {
  selectionToJson,
  signQuery,
  type QuerySelection,
} from "@meshql/client";
import type { StoredAuth } from "./types.js";

export type SseSubscribeOptions = {
  entity: string;
  entityId: string;
  auth: StoredAuth;
  onUpdate: (data: unknown) => void;
  onError?: (message: string) => void;
};

/** Fetch-based SSE reader — EventSource cannot send signed MeshQL headers. */
export function subscribeMeshEvents(
  selection: QuerySelection,
  options: SseSubscribeOptions,
): () => void {
  const controller = new AbortController();
  let closed = false;

  const run = async () => {
    const raw = selectionToJson(selection);
    const headers = await signQuery(raw, {
      format: "json",
      signingToken: options.auth.signingToken,
      token: options.auth.token,
    });

    const url = `/mesh/${options.entity}/${options.entityId}/events`;
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      options.onError?.(`SSE failed (${response.status})`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!closed) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        if (!part.trim() || part.startsWith(":")) continue;

        let event = "message";
        let data = "";
        for (const line of part.split("\n")) {
          if (line.startsWith("event:")) {
            event = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            data += line.slice(5).trim();
          }
        }

        if (event === "update" && data) {
          try {
            options.onUpdate(JSON.parse(data));
          } catch {
            options.onError?.("Invalid SSE payload");
          }
        } else if (event === "error" && data) {
          try {
            const parsed = JSON.parse(data) as { message?: string };
            options.onError?.(parsed.message ?? "Subscription error");
          } catch {
            options.onError?.("Subscription error");
          }
        }
      }
    }
  };

  void run().catch((error) => {
    if (!closed && error instanceof Error && error.name !== "AbortError") {
      options.onError?.(error.message);
    }
  });

  return () => {
    closed = true;
    controller.abort();
  };
}
