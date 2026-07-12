import type { PubSubMessage } from "./store.js";

/** Wire format for cross-process pub/sub backends. */
export interface PubSubWireMessage {
  channel: string;
  payload: unknown;
  publishedAt: number;
}

export function encodePubSubWire(
  channel: string,
  payload: unknown,
): string {
  const message: PubSubWireMessage = {
    channel,
    payload,
    publishedAt: Date.now(),
  };
  return JSON.stringify(message);
}

export function decodePubSubWire(
  channel: string,
  raw: string,
): PubSubMessage {
  try {
    const parsed = JSON.parse(raw) as Partial<PubSubWireMessage>;
    return {
      channel: parsed.channel ?? channel,
      payload: parsed.payload,
      publishedAt: parsed.publishedAt ?? Date.now(),
    };
  } catch {
    return {
      channel,
      payload: raw,
      publishedAt: Date.now(),
    };
  }
}
