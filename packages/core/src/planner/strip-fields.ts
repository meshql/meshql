import type { JoinPlan } from "./join-plan.js";
import type { MeshSchema } from "../schema/schema.js";
import { entityTable } from "../schema/schema.js";

/**
 * Normalize a schema field path to plan field notation.
 * e.g. user.email → users.email, user.tokens.accessToken → tokens.accessToken
 */
export function normalizeFieldPath(
  path: string,
  schema: MeshSchema,
): string {
  const parts = path.split(".");
  if (parts.length === 1) {
    return path;
  }

  const entity = parts[0];
  if (!entity) {
    return path;
  }

  const rest = parts.slice(1);
  const config = schema.entities[entity];

  if (rest.length === 1) {
    const table = entityTable(entity, config);
    return `${table}.${rest[0]}`;
  }

  const [refName, ...fieldParts] = rest;
  if (!refName) {
    return path;
  }

  if (fieldParts.length === 0) {
    return `${refName}.`;
  }

  return `${refName}.${fieldParts.join(".")}`;
}

function fieldMatchesDenied(field: string, denied: string): boolean {
  if (denied.endsWith(".")) {
    return field.startsWith(denied);
  }
  return field === denied;
}

/** Remove denied field paths from a join plan (silent strip). */
export function stripFieldsFromPlan(
  plan: JoinPlan,
  deniedPaths: string[],
  schema: MeshSchema,
): JoinPlan {
  if (deniedPaths.length === 0) {
    return plan;
  }

  const denied = deniedPaths.map((p) => normalizeFieldPath(p, schema));

  const fields = plan.fields.filter(
    (f) => !denied.some((d) => fieldMatchesDenied(f, d)),
  );

  const joins = plan.joins.map((join) => ({
    ...join,
    fields: join.fields.filter(
      (f) => !denied.some((d) => fieldMatchesDenied(f, d)),
    ),
  }));

  return { ...plan, fields, joins };
}

/** Check if a field path matches a denied path (supports nested join paths). */
export function isFieldDenied(
  fieldPath: string,
  rulePath: string,
  schema: MeshSchema,
): boolean {
  const normalized = normalizeFieldPath(rulePath, schema);
  return fieldMatchesDenied(fieldPath, normalized);
}
