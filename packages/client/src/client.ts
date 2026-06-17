import { encodeQuery } from "@meshql/http";
import {
  selectionToJson,
  selectionToQl,
  type QuerySelection,
} from "./query-builder.js";

export interface MeshClientOptions {
  url: string;
  format?: "json" | "ql";
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface MeshClient {
  query<T = Record<string, unknown>>(
    selection: QuerySelection,
    options?: { entityId?: string },
  ): Promise<T>;
}

export function createClient(options: MeshClientOptions): MeshClient {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const format = options.format ?? "json";

  return {
    async query<T = Record<string, unknown>>(
      selection: QuerySelection,
      requestOptions: { entityId?: string } = {},
    ) {
      const rootEntity = Object.keys(selection)[0];
      if (!rootEntity) {
        throw new Error("Query selection must include a root entity");
      }

      const raw =
        format === "json"
          ? selectionToJson(selection)
          : selectionToQl(selection);

      const path = requestOptions.entityId
        ? `${options.url}/${rootEntity}/${requestOptions.entityId}`
        : `${options.url}/${rootEntity}`;

      const response = await fetchFn(path, {
        method: "GET",
        headers: {
          ...options.headers,
          ...encodeQuery(raw, format),
        },
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(errorBody.message ?? `MeshQL request failed (${response.status})`);
      }

      return (await response.json()) as T;
    },
  };
}

export { selectionToJson, selectionToQl } from "./query-builder.js";
export type { QuerySelection } from "./query-builder.js";
