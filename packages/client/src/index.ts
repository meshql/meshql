/**
 * Typed client SDK for MeshQL APIs.
 *
 * @module
 *
 * @example
 * ```ts
 * import { createClient } from "@meshql/client";
 *
 * const client = createClient({ url: "http://localhost:3000/mesh" });
 * const user = await client.query({
 *   user: { id: true, email: true },
 * });
 * ```
 */
export { createClient, createAuthClient } from "./client.js";
export type {
  MeshClient,
  MeshClientOptions,
  AuthClientOptions,
  AuthMeshClient,
  AuthTokens,
  WriteOptions,
  WritePayload,
  QueryControls,
} from "./client.js";
export { encodeQuery, signQuery } from "./sign.js";
export type { QueryFormat, SignQueryOptions } from "./sign.js";
export {
  selectionToJson,
  selectionToQl,
  type QuerySelection,
} from "./query-builder.js";
