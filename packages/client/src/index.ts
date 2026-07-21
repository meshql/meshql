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
 *   user: { $select: { id: true, email: true } },
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
} from "./client.js";
export { encodeQuery, signQuery } from "./sign.js";
export type { QueryFormat, SignQueryOptions } from "./sign.js";
export { queryToQl } from "./query-builder.js";
export {
  queryToJson,
  type MeshQuery,
  type ReadNode,
  type ReadSelection,
} from "./read-query.js";
