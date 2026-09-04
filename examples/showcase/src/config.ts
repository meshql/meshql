/** Server-side showcase config. Client stays on relative `/mesh`. */

export const DEFAULT_MESH_SECRET = "showcase-secret";

export const PUBLIC_ORIGIN =
  process.env.PUBLIC_ORIGIN ?? "https://showcase.meshql.dev";

export const HOST = process.env.HOST ?? "0.0.0.0";

export const PORT = Number(process.env.PORT ?? 3010);
