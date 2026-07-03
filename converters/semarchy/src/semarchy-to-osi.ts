/**
 * Import: Semarchy -> OSI.
 *
 * Produces an OSI document that must validate against `core-spec/osi-schema.json`.
 * Semarchy metadata with no OSI core equivalent must be captured into
 * `custom_extensions` (vendor_name "SEMARCHY") so a Semarchy -> OSI -> Semarchy
 * roundtrip stays faithful.
 */
import { OSI_VERSION } from "./osi-types.js";
import type { OSIDocument, OSISemanticModel } from "./osi-types.js";
import type { SemarchyModel } from "./semarchy-types.js";

export interface ImportResult {
  document: OSIDocument;
  warnings: string[];
}

/** Convert a Semarchy model into an OSI document. */
export function semarchyToOsi(
  semarchy: SemarchyModel,
  warnings: string[] = [],
): ImportResult {
  const semanticModel: OSISemanticModel = {
    name: semarchy.name,
    description: semarchy.description,
    datasets: [],
  };

  // TODO(schema): map Semarchy entities -> datasets, attributes -> fields
  //   (emit expression.dialects with dialect "SEMARCHY"), relationships,
  //   measures -> metrics. Anything without an OSI equivalent goes into
  //   custom_extensions with vendor_name "SEMARCHY".

  const document: OSIDocument = {
    version: OSI_VERSION,
    semantic_model: [semanticModel],
  };

  return { document, warnings };
}
