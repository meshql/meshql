import type { QueryFormat } from "@meshql/http";

/** Stored persisted query record. */
export interface PersistedQuery {
  raw: string;
  format: QueryFormat;
  createdAt: number;
}

/** Persisted query store interface. */
export interface QueryStore {
  save(id: string, record: PersistedQuery): void;
  get(id: string): PersistedQuery | undefined;
  findByContent(raw: string, format: QueryFormat): string | undefined;
}

/** In-memory query store (single-process). */
export class InMemoryQueryStore implements QueryStore {
  private byId = new Map<string, PersistedQuery>();
  private byContent = new Map<string, string>();

  save(id: string, record: PersistedQuery): void {
    this.byId.set(id, record);
    this.byContent.set(contentKey(record.raw, record.format), id);
  }

  get(id: string): PersistedQuery | undefined {
    return this.byId.get(id);
  }

  findByContent(raw: string, format: QueryFormat): string | undefined {
    return this.byContent.get(contentKey(raw, format));
  }
}

export function contentKey(raw: string, format: QueryFormat): string {
  return `${format}\0${raw}`;
}
