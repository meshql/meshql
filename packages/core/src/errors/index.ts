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

export class TransportError extends MeshError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TransportError", details);
  }
}

export class ValidationError extends MeshError {
  constructor(
    message: string,
    public readonly location?: { line: number; col: number },
  ) {
    super(message, "ValidationError", location ? { location } : undefined);
  }
}

export class ResolverError extends MeshError {
  constructor(
    message: string,
    public readonly entity: string,
  ) {
    super(message, "ResolverError", { entity });
  }
}

export class ParseError extends MeshError {
  constructor(message: string) {
    super(message, "ParseError");
  }
}
