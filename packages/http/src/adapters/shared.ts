import type { MeshInstance } from "@meshql/core";
import type { HttpRequest } from "../handlers/index.js";
import { createHttpHandler } from "../index.js";

export function toHttpRequest(input: {
  method: string;
  params?: { entity?: string; id?: string };
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}): HttpRequest {
  return {
    method: input.method,
    params: input.params ?? {},
    headers: input.headers,
    body: input.body,
  };
}

export function createMeshHttpHandler(mesh: MeshInstance) {
  return createHttpHandler(mesh);
}
