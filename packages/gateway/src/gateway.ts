import {
  parseJsonQuery,
  parseQl,
  type MeshSchema,
} from "@meshql/core";
import { encodeQuery } from "@meshql/client";

/** One downstream MeshQL service in a static gateway config. */
export interface GatewayService {
  name: string;
  baseUrl: string;
  entities: string[];
}

/** Static multi-service gateway configuration (V1). */
export interface GatewayConfig {
  schema: MeshSchema;
  services: GatewayService[];
  headers?: Record<string, string>;
}

export interface GatewayExecuteOptions {
  format?: "json" | "ql";
  entityId?: string;
  list?: Record<string, unknown>;
}

export interface GatewayInstance {
  schema: MeshSchema;
  execute(query: string, options?: GatewayExecuteOptions): Promise<unknown>;
}

function serviceForEntity(
  config: GatewayConfig,
  entity: string,
): GatewayService | undefined {
  return config.services.find((service) => service.entities.includes(entity));
}

function rootEntityFromQuery(query: string, format: "json" | "ql"): string {
  if (format === "json") {
    return parseJsonQuery(query).root.name;
  }
  return parseQl(query).root.name;
}

async function fetchService(
  service: GatewayService,
  entity: string,
  query: string,
  options: GatewayExecuteOptions,
  extraHeaders?: Record<string, string>,
): Promise<unknown> {
  const headers = {
    ...encodeQuery(query, options.format ?? "json"),
    ...extraHeaders,
  };

  const path = options.entityId
    ? `${service.baseUrl}/${entity}/${options.entityId}`
    : `${service.baseUrl}/${entity}`;

  const response = await fetch(path, { method: "GET", headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(
      body.message ?? `Gateway fetch ${service.name} failed (${response.status})`,
    );
  }

  return response.json();
}

/**
 * Create a static MeshQL gateway that routes queries to downstream services
 * by root entity and stitches cross-service joins in-process.
 */
export function createGateway(config: GatewayConfig): GatewayInstance {
  return {
    schema: config.schema,
    async execute(query, options = {}) {
      const format = options.format ?? "json";
      const rootEntity = rootEntityFromQuery(query, format);
      const rootService = serviceForEntity(config, rootEntity);
      if (!rootService) {
        throw new Error(`No gateway service owns entity '${rootEntity}'`);
      }

      const rootResult = await fetchService(
        rootService,
        rootEntity,
        query,
        options,
        config.headers,
      );

      const joinEntries = Object.entries(config.schema.joins).filter(([joinPath]) =>
        joinPath.startsWith(`${rootEntity}.`),
      );

      if (joinEntries.length === 0) {
        return rootResult;
      }

      if (Array.isArray(rootResult)) {
        return rootResult;
      }

      if (!rootResult || typeof rootResult !== "object") {
        return rootResult;
      }

      const stitched = { ...(rootResult as Record<string, unknown>) };

      for (const [joinPath, join] of joinEntries) {
        const joinField = joinPath.slice(rootEntity.length + 1);
        const joinService = serviceForEntity(config, join.entity);
        if (!joinService || joinService.name === rootService.name) {
          continue;
        }

        const nestedQuery =
          format === "json"
            ? JSON.stringify({ [join.entity]: { $select: { id: true } } })
            : `{ ${join.entity} { id } }`;

        const nested = await fetchService(
          joinService,
          join.entity,
          nestedQuery,
          { format },
          config.headers,
        );

        stitched[joinField] = nested;
      }

      return stitched;
    },
  };
}

export type { MeshSchema };
