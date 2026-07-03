/**
 * TypeScript types for the Semarchy semantic model.
 *
 * TODO(schema): These are PLACEHOLDER shapes. The real definitions must be
 * derived from the Semarchy semantic-model JSON Schema, which should be dropped
 * into `converters/semarchy/schemas/semarchy-semantic-model-schema.json` (see
 * README). Once the schema is available:
 *   1. Replace these interfaces with the real Semarchy constructs.
 *   2. Wire the schema into `validateSemarchy()` in `semarchy-schema.ts`.
 *   3. Complete the mapping in `osi-to-semarchy.ts` / `semarchy-to-osi.ts`.
 */

/** Placeholder root object of a Semarchy semantic model. */
export interface SemarchyModel {
  name: string;
  description?: string;
  // TODO(schema): entities, attributes, relationships, measures, etc.
  [key: string]: unknown;
}
