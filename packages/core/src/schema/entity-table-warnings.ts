import type { MeshSchema } from "./schema.js";
import { entityTable } from "./schema.js";

const IRREGULAR_PLURALS: Record<string, string> = {
  person: "people",
  child: "children",
  man: "men",
  woman: "women",
  tooth: "teeth",
  foot: "feet",
  mouse: "mice",
  goose: "geese",
};

const SINGULAR_ENDING_IN_S = new Set([
  "address",
  "alias",
  "bus",
  "canvas",
  "class",
  "gas",
  "lens",
  "status",
  "virus",
]);

function suggestedTable(entity: string): string | undefined {
  if (IRREGULAR_PLURALS[entity]) {
    return IRREGULAR_PLURALS[entity];
  }

  if (/[^aeiou]y$/i.test(entity)) {
    return `${entity.slice(0, -1)}ies`;
  }

  if (/(?:sh|ch|x|z)$/i.test(entity)) {
    return `${entity}es`;
  }

  if (entity.endsWith("s") && SINGULAR_ENDING_IN_S.has(entity)) {
    return `${entity}es`;
  }

  return undefined;
}

/**
 * Warn when an entity key is likely to resolve to the wrong SQL table name
 * because {@link entityTable} only handles regular `+s` / trailing-`s` rules.
 */
export function warnAmbiguousEntityTables(schema: MeshSchema): void {
  for (const [entity, config] of Object.entries(schema.entities)) {
    if (config.table) {
      continue;
    }

    const suggested = suggestedTable(entity);
    if (!suggested) {
      continue;
    }

    const resolved = entityTable(entity, config);
    if (resolved === suggested) {
      continue;
    }

    console.warn(
      `[meshql] entities.${entity} resolves to SQL table "${resolved}"; ` +
        `if your table is "${suggested}", set entities.${entity}.table = "${suggested}".`,
    );
  }
}
