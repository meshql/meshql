import type { ComputedFieldDef } from "../schema/schema.js";

/** A computed field requested in the query, ready for post-fetch application. */
export interface PlanComputedField {
  /** Empty string for root; join path for nested (e.g. `"comments.author"`). */
  path: string;
  /** Entity that owns the computed definition. */
  entity: string;
  /** Computed field name as requested in the query. */
  name: string;
  def: ComputedFieldDef;
  /**
   * Whether each `from` dep was also explicitly selected by the client.
   * Used to strip unrequested source fields after compute on the
   * preshaped path.
   */
  requestedDeps: Set<string>;
}
