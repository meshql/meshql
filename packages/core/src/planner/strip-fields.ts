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

function isAccessPathDenied(
  entity: string,
  field: string,
  deniedNormalized: string[],
  schema: MeshSchema,
): boolean {
  const accessPath = `${entity}.${field}`;
  const normalized = normalizeFieldPath(accessPath, schema);
  return deniedNormalized.some(
    (d) =>
      fieldMatchesDenied(normalized, d) || fieldMatchesDenied(accessPath, d),
  );
}

/**
 * Plan-field notation for a computed dependency relative to its owning entity.
 * Same-entity root: `users.firstName`. Join path: `tokens.accessToken`.
 * Cross-entity: `customer.firstName`.
 */
function depToPlanField(
  entityKey: string,
  dep: string,
  joinPath: string,
  schema: MeshSchema,
): string {
  if (!dep.includes(".")) {
    if (joinPath) {
      return `${joinPath}.${dep}`;
    }
    const table = entityTable(entityKey, schema.entities[entityKey]);
    return `${table}.${dep}`;
  }

  const [refName, ...rest] = dep.split(".");
  const field = rest.join(".");
  const childPath = joinPath ? `${joinPath}.${refName}` : refName!;
  return `${childPath}.${field}`;
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

  const deniedNormalized = deniedPaths.map((p) =>
    normalizeFieldPath(p, schema),
  );

  const remainingComputed = (plan.computedFields ?? []).filter(
    (entry) => !isAccessPathDenied(entry.entity, entry.name, deniedNormalized, schema),
  );

  // Deps fetched only for denied computed fields (not also requested) must go.
  const depDenied: string[] = [];
  for (const entry of plan.computedFields ?? []) {
    if (!isAccessPathDenied(entry.entity, entry.name, deniedNormalized, schema)) {
      continue;
    }
    for (const dep of entry.def.from) {
      if (entry.requestedDeps.has(dep)) continue;
      // Keep if another remaining computed still needs this dep
      const stillNeeded = remainingComputed.some((other) =>
        other.def.from.includes(dep) &&
        other.entity === entry.entity &&
        other.path === entry.path,
      );
      if (stillNeeded) continue;
      depDenied.push(depToPlanField(entry.entity, dep, entry.path, schema));
    }
  }

  const denied = [...deniedNormalized, ...depDenied];

  const fields = plan.fields.filter(
    (f) => !denied.some((d) => fieldMatchesDenied(f, d)),
  );

  const joins = plan.joins.map((join) => ({
    ...join,
    fields: join.fields.filter(
      (f) => !denied.some((d) => fieldMatchesDenied(f, d)),
    ),
  }));

  return {
    ...plan,
    fields,
    joins,
    computedFields:
      remainingComputed.length > 0 ? remainingComputed : undefined,
  };
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
