export interface QueryContext {
  requestId: string;
  method: "GET" | "POST" | "PUT" | "DELETE";

  userId?: string;
  role?: string;
  tenantId?: string;
  entityId?: string;

  [key: string]: unknown;
}

export function createQueryContext(
  partial: Partial<QueryContext> & Pick<QueryContext, "requestId" | "method">,
): QueryContext {
  return { ...partial };
}
