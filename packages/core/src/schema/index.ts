export {
  entityTable,
  entityIdField,
  entityPhysicalIdColumn,
  hasThroughJoin,
  hasPolymorphicJoin,
  joinTargetEntity,
  type EntityConfig,
  type JoinConfig,
  type ThroughConfig,
  type PolymorphicConfig,
  type MeshConfig,
  type MeshSchema,
} from "./schema.js";
export { validateJoins } from "./validate-joins.js";
export { validateComputedFields } from "./validate-computed.js";
