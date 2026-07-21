/** A captured SQL statement from a resolver during query execution. */
export interface SqlTraceEntry {
  sql: string;
  params: unknown[];
}

/** Mutable collector attached to a join plan when SQL tracing is enabled. */
export interface SqlTraceCollector {
  readonly entries: SqlTraceEntry[];
  record(entry: SqlTraceEntry): void;
}

/** Create a SQL trace collector for {@link JoinPlan.sqlTrace}. */
export function createSqlTraceCollector(): SqlTraceCollector {
  const entries: SqlTraceEntry[] = [];
  return {
    entries,
    record(entry) {
      entries.push(entry);
    },
  };
}

/** Record SQL on a plan when tracing is active. No-op otherwise. */
export function recordPlanSql(
  plan: { sqlTrace?: SqlTraceCollector },
  entry: SqlTraceEntry,
): void {
  plan.sqlTrace?.record(entry);
}
