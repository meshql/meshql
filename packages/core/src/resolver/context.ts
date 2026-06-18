/** Request-scoped context passed to resolvers during query execution. */
export interface QueryContext {
  requestId: string;
  method: "GET" | "POST" | "PUT" | "DELETE";

  userId?: string;
  role?: string;
  tenantId?: string;
  entityId?: string;

  [key: string]: unknown;
}

/** Create a query context with required request metadata. */
export function createQueryContext(
  partial: Partial<QueryContext> & Pick<QueryContext, "requestId" | "method">,
): QueryContext {
  return { ...partial };
}
