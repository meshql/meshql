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
export { createClient } from "./client.js";
export type { MeshClient, MeshClientOptions } from "./client.js";
export {
  selectionToJson,
  selectionToQl,
  type QuerySelection,
} from "./query-builder.js";
