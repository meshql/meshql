import { convertGraphqlSdl, renderMeshSchema } from "./graphql-sdl.js";
import type { GraphqlSdlResult } from "./graphql-sdl.js";

export { convertGraphqlSdl, renderMeshSchema } from "./graphql-sdl.js";
export type { CodemodReport, GraphqlSdlResult } from "./graphql-sdl.js";

/** Run GraphQL SDL → MeshQL conversion and return files + report. */
export function migrateGraphqlSdl(sdl: string): GraphqlSdlResult & {
  schemaSource: string;
} {
  const result = convertGraphqlSdl(sdl);
  return {
    ...result,
    schemaSource: renderMeshSchema(result.schema),
  };
}
