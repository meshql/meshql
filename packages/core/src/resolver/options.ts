/** Options when registering an entity resolver. */
export interface ResolverOptions {
  /**
   * When true, the resolver returns already-nested JSON and the shaper is
   * skipped. ORM adapters should always set this.
   */
  preshaped?: boolean;
}

/** Internal resolver registration record. */
export interface RegisteredResolver {
  resolver: import("./registry.js").Resolver;
  preshaped: boolean;
}
