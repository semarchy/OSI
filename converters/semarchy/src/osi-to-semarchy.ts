/**
 * Export: OSI -> Semarchy.
 *
 * Scope (per project decision): dataset -> Entity, field -> EntityAttribute,
 * unique_keys -> UniqueKey, relationship -> Reference. OSI metrics have no
 * Semarchy target and are dropped with a warning. Semarchy requires several
 * fields OSI does not carry (physical names, labels, entity type, etc.); those
 * are filled with sensible defaults so the output validates against the
 * Semarchy schemas.
 */
import { selectExpression } from "./dialect.js";
import type {
  OSIDataset,
  OSIDocument,
  OSIField,
  OSIRelationship,
  OSISemanticModel,
} from "./osi-types.js";
import type {
  SemarchyEntity,
  SemarchyEntityAttribute,
  SemarchyModel,
  SemarchyReference,
  SemarchyUniqueKey,
} from "./semarchy-types.js";

export interface ExportResult {
  model: SemarchyModel;
  warnings: string[];
}

/** Semarchy `_name` pattern: ^[a-zA-Z][a-zA-Z_0-9]*$. */
function logicalName(name: string, warnings: string[], what: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^([^a-zA-Z])/, "n$1");
  if (cleaned !== name) {
    warnings.push(`[rename] ${what} "${name}" -> "${cleaned}" (Semarchy name rules)`);
  }
  return cleaned;
}

/** Semarchy physicalName pattern: ^[A-Z][A-Z_0-9]*$. */
function physicalName(name: string): string {
  const upper = name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return /^[A-Z]/.test(upper) ? upper : `T_${upper}`;
}

/** Best-effort Semarchy data type from an OSI field. */
function dataTypeOf(field: OSIField): string {
  return field.dimension?.is_time ? "Timestamp" : "String";
}

function fieldToAttribute(
  field: OSIField,
  warnings: string[],
): SemarchyEntityAttribute {
  // The physical column comes from the selected expression when it is a bare
  // column reference; otherwise fall back to the field name.
  const sel = selectExpression(field.expression, `field ${field.name}`, warnings);
  const column = sel?.expression ?? field.name;
  return {
    _type: "EntityAttribute",
    _name: logicalName(field.name, warnings, "attribute"),
    label: field.label ?? field.name,
    physicalName: physicalName(column),
    dataType: dataTypeOf(field),
    ...(field.description ? { description: field.description } : {}),
  };
}

function datasetToEntity(
  dataset: OSIDataset,
  pkg: string,
  warnings: string[],
): SemarchyEntity {
  const fields = dataset.fields ?? [];
  if (fields.length === 0) {
    warnings.push(
      `[warn] dataset "${dataset.name}": no fields; Semarchy entities require ` +
        `at least one attribute`,
    );
  }
  // source is `db.schema.table`; the physical table name is the last segment.
  const table = dataset.source.split(".").pop() ?? dataset.name;

  const entity: SemarchyEntity = {
    _type: "Entity",
    _package: pkg,
    _name: logicalName(dataset.name, warnings, "entity"),
    label: dataset.name,
    pluralLabel: `${dataset.name}s`,
    physicalTableName: physicalName(table),
    entityType: "BASIC",
    historizeGolden: false,
    historizeMaster: false,
    attributes: fields.map((f) => fieldToAttribute(f, warnings)),
  };
  if (dataset.description) entity.description = dataset.description;

  if (dataset.primary_key?.length) {
    if (dataset.primary_key.length > 1) {
      warnings.push(
        `[warn] dataset "${dataset.name}": composite primary key ` +
          `[${dataset.primary_key.join(", ")}] flattened to first column ` +
          `(Semarchy uses a single primary-key attribute)`,
      );
    }
    entity.primaryKey = logicalName(dataset.primary_key[0]!, warnings, "attribute");
  }

  return entity;
}

function uniqueKeysOf(
  dataset: OSIDataset,
  pkg: string,
  warnings: string[],
): SemarchyUniqueKey[] {
  return (dataset.unique_keys ?? []).map((cols, i) => ({
    _type: "UniqueKey",
    _package: pkg,
    _name: logicalName(`${dataset.name}_uk${i + 1}`, warnings, "unique key"),
    label: `${dataset.name} unique key ${i + 1}`,
    entity: logicalName(dataset.name, warnings, "entity"),
    keyAttributes: cols.map((c) => ({
      attribute: logicalName(c, warnings, "attribute"),
    })),
    validationLabel: `${dataset.name} unique key ${i + 1} must be unique`,
    validationScope: "NONE",
  }));
}

function relationshipToReference(
  rel: OSIRelationship,
  pkg: string,
  warnings: string[],
): SemarchyReference {
  if (rel.from_columns.length > 1 || rel.to_columns.length > 1) {
    warnings.push(
      `[warn] relationship "${rel.name}": composite foreign key flattened to ` +
        `the first column (Semarchy references model a single foreign key)`,
    );
  }
  const fromCol = rel.from_columns[0] ?? "REF";
  return {
    _type: "Reference",
    _package: pkg,
    _name: logicalName(rel.name, warnings, "reference"),
    label: rel.name,
    physicalName: physicalName(rel.name),
    fromEntity: logicalName(rel.from, warnings, "entity"),
    toEntity: logicalName(rel.to, warnings, "entity"),
    fromRoleLabel: rel.from,
    fromRoleName: logicalName(rel.from, warnings, "role"),
    fromRolePluralLabel: `${rel.from}s`,
    toRoleLabel: rel.to,
    toRoleName: logicalName(rel.to, warnings, "role"),
    toRolePhysicalName: physicalName(fromCol),
    deletePropagation: "RESTRICT",
    validationScope: "NONE",
  };
}

/** Convert a single OSI semantic model to a grouped Semarchy model. */
export function osiToSemarchy(
  osi: OSISemanticModel,
  warnings: string[] = [],
): ExportResult {
  const pkg = logicalName(osi.name, warnings, "package");

  const entities = (osi.datasets ?? []).map((d) =>
    datasetToEntity(d, pkg, warnings),
  );
  const uniqueKeys = (osi.datasets ?? []).flatMap((d) =>
    uniqueKeysOf(d, pkg, warnings),
  );
  const references = (osi.relationships ?? []).map((r) =>
    relationshipToReference(r, pkg, warnings),
  );

  for (const metric of osi.metrics ?? []) {
    warnings.push(
      `[drop] metric "${metric.name}": Semarchy xDM has no measure concept`,
    );
  }

  return { model: { pkg, entities, references, uniqueKeys }, warnings };
}

/** Convenience wrapper over a full OSI document (converts the first model). */
export function osiDocumentToSemarchy(doc: OSIDocument): ExportResult {
  if (!doc.semantic_model?.length) {
    throw new Error("OSI document has no semantic_model entries");
  }
  return osiToSemarchy(doc.semantic_model[0]!);
}
