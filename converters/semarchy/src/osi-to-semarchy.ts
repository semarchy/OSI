/**
 * Export: OSI -> Semarchy.
 *
 * Follows the 9-step export procedure from the converter guide. The dataset /
 * field / relationship / metric traversal and the dialect-fallback plumbing are
 * in place; the per-construct emission into Semarchy shapes is marked TODO until
 * the Semarchy JSON Schema lands.
 */
import { selectExpression } from "./dialect.js";
import type { OSIDocument, OSISemanticModel } from "./osi-types.js";
import type { SemarchyModel } from "./semarchy-types.js";

export interface ExportResult {
  model: SemarchyModel;
  warnings: string[];
}

const SEMARCHY_VENDOR = "SEMARCHY";

/** Convert a single OSI semantic model to a Semarchy model. */
export function osiToSemarchy(
  osi: OSISemanticModel,
  warnings: string[] = [],
): ExportResult {
  const model: SemarchyModel = {
    name: osi.name,
    description: osi.description,
  };

  // Step 3-4: datasets and their fields (dialect fallback: SEMARCHY -> ANSI_SQL).
  for (const dataset of osi.datasets ?? []) {
    for (const field of dataset.fields ?? []) {
      selectExpression(
        field.expression,
        `dataset ${dataset.name}, field ${field.name}`,
        warnings,
      );
      // TODO(schema): emit Semarchy attribute from the selected expression.
    }
    // TODO(schema): emit Semarchy entity (source, primary_key, unique_keys).
  }

  // Step 5: relationships (preserve composite-key column ordering).
  for (const _rel of osi.relationships ?? []) {
    // TODO(schema): emit Semarchy relationship (from/to, from_columns/to_columns).
  }

  // Step 6: metrics (same dialect logic; resolve cross-dataset references).
  for (const metric of osi.metrics ?? []) {
    selectExpression(metric.expression, `metric ${metric.name}`, warnings);
    // TODO(schema): emit Semarchy measure.
  }

  // Step 7: apply SEMARCHY custom_extensions; every other vendor's entries are
  // preserved on the import side, never here.
  for (const ext of osi.custom_extensions ?? []) {
    if (ext.vendor_name === SEMARCHY_VENDOR) {
      // TODO(schema): merge JSON.parse(ext.data) into the Semarchy model.
    }
  }

  // Step 8: ai_context -> Semarchy annotations. TODO(schema).

  return { model, warnings };
}

/** Convenience wrapper over a full OSI document (converts the first model). */
export function osiDocumentToSemarchy(doc: OSIDocument): ExportResult {
  if (!doc.semantic_model?.length) {
    throw new Error("OSI document has no semantic_model entries");
  }
  return osiToSemarchy(doc.semantic_model[0]!);
}
