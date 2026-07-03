/** Public library API for the OSI <> Semarchy converter. */
export * from "./osi-types.js";
export * from "./semarchy-types.js";
export { osiToSemarchy, osiDocumentToSemarchy } from "./osi-to-semarchy.js";
export type { ExportResult } from "./osi-to-semarchy.js";
export { semarchyToOsi } from "./semarchy-to-osi.js";
export type { ImportResult } from "./semarchy-to-osi.js";
export { selectExpression } from "./dialect.js";
export {
  validateSemarchy,
  validateOsi,
  SEMARCHY_SCHEMA_PATH,
  OSI_SCHEMA_PATH,
} from "./validation.js";
export type { ValidationOutcome } from "./validation.js";
