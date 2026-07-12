const PREFIX = "meshql";

/** Channel for all updates on an entity type (list invalidation, fan-out). */
export function entityChannel(entity: string): string {
  return `${PREFIX}:${entity}`;
}

/** Channel for updates to one entity record (SSE subscription target). */
export function entityRecordChannel(entity: string, id: string | number): string {
  return `${PREFIX}:${entity}:${String(id)}`;
}

/** Parse a MeshQL channel back into entity (+ optional id). Returns null if unknown format. */
export function parseMeshChannel(
  channel: string,
): { entity: string; id?: string } | null {
  if (!channel.startsWith(`${PREFIX}:`)) {
    return null;
  }

  const rest = channel.slice(PREFIX.length + 1);
  const parts = rest.split(":");
  if (parts.length === 1) {
    return { entity: parts[0]! };
  }
  if (parts.length === 2) {
    return { entity: parts[0]!, id: parts[1] };
  }

  return null;
}
