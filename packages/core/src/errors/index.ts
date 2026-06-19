/** Base error for all MeshQL failures. */
export class MeshError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = code;
  }
}

/** Raised when query transport headers or encoding are invalid. */
export class TransportError extends MeshError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TransportError", details);
  }
}

/** Raised when a query or schema validation fails. */
export class ValidationError extends MeshError {
  constructor(
    message: string,
    public readonly location?: { line: number; col: number },
  ) {
    super(message, "ValidationError", location ? { location } : undefined);
  }
}

/** Raised when an entity resolver fails or is missing. */
export class ResolverError extends MeshError {
  constructor(
    message: string,
    public readonly entity: string,
  ) {
    super(message, "ResolverError", { entity });
  }
}

/** Raised when query parsing fails. */
export class ParseError extends MeshError {
  constructor(message: string) {
    super(message, "ParseError");
  }
}

/** Raised when query integrity or signature verification fails. */
export class IntegrityError extends MeshError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, "IntegrityError", details);
  }
}
