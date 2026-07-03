/**
 * Import: Semarchy -> OSI.
 *
 * Scope (per project decision): map Entity -> dataset, EntityAttribute -> field,
 * UniqueKey -> unique_keys, Reference -> relationship. Everything else is dropped
 * with a warning (lossy roundtrip is accepted). No metrics are produced: Semarchy
 * xDM has no aggregate-measure concept.
 *
 * Cross-references use attribute `_name` (Semarchy references attributes by
 * `_name`), so OSI field names are attribute `_name`s and the ANSI_SQL
 * expression carries the physical column name.
 */
import { OSI_VERSION } from "./osi-types.js";
import type {
  OSIDataset,
  OSIDocument,
  OSIField,
  OSIRelationship,
  OSISemanticModel,
} from "./osi-types.js";
import { TIME_DATA_TYPES } from "./semarchy-types.js";
import type {
  SemarchyEntity,
  SemarchyModel,
  SemarchyReference,
} from "./semarchy-types.js";

export interface ImportResult {
  document: OSIDocument;
  warnings: string[];
}

function attributeToField(
  attr: SemarchyEntity["attributes"][number],
): OSIField {
  const column = attr.physicalName || attr._name;
  const field: OSIField = {
    name: attr._name,
    expression: { dialects: [{ dialect: "ANSI_SQL", expression: column }] },
  };
  if (attr.label) field.label = attr.label;
  const description = attr.description ?? attr.documentation;
  if (description) field.description = description;
  if (TIME_DATA_TYPES.has(String(attr.dataType))) {
    field.dimension = { is_time: true };
  }
  return field;
}

function entityToDataset(
  entity: SemarchyEntity,
  model: SemarchyModel,
): OSIDataset {
  const dataset: OSIDataset = {
    name: entity._name,
    source: `${entity._package}.${entity.physicalTableName}`,
    fields: entity.attributes.map((a) => attributeToField(a)),
  };

  const description = entity.description ?? entity.documentation;
  if (description) dataset.description = description;
  if (entity.primaryKey) dataset.primary_key = [entity.primaryKey];

  const uniqueKeys = model.uniqueKeys
    .filter((uk) => uk.entity === entity._name)
    .map((uk) => uk.keyAttributes.map((k) => k.attribute));
  if (uniqueKeys.length) dataset.unique_keys = uniqueKeys;

  return dataset;
}

function referenceToRelationship(
  ref: SemarchyReference,
  entitiesByName: Map<string, SemarchyEntity>,
  warnings: string[],
): OSIRelationship | undefined {
  const toEntity = entitiesByName.get(ref.toEntity);
  const toColumn = toEntity?.primaryKey;
  if (!toColumn) {
    warnings.push(
      `[drop] reference "${ref._name}": cannot resolve primary key of ` +
        `to-entity "${ref.toEntity}"; relationship skipped`,
    );
    return undefined;
  }
  // Semarchy expresses the FK implicitly; the foreign attribute on the many side
  // is the best available "from" column, else the role name.
  const foreignAttr = (ref.foreignAttribute as { _name?: string } | undefined)
    ?._name;
  const fromColumn = foreignAttr ?? ref.toRoleName;
  if (!fromColumn) {
    warnings.push(
      `[drop] reference "${ref._name}": cannot resolve foreign key column; ` +
        `relationship skipped`,
    );
    return undefined;
  }
  // OSI relationships carry no description; Semarchy reference metadata beyond
  // the join columns is dropped (accepted, per the minimal-scope decision).
  return {
    name: ref._name,
    from: ref.fromEntity,
    to: ref.toEntity,
    from_columns: [fromColumn],
    to_columns: [toColumn],
  };
}

/** Convert a grouped Semarchy model into an OSI document. */
export function semarchyToOsi(
  model: SemarchyModel,
  warnings: string[] = [],
): ImportResult {
  const entitiesByName = new Map(model.entities.map((e) => [e._name, e]));

  const datasets = model.entities.map((e) => entityToDataset(e, model));

  const relationships = model.references
    .map((r) => referenceToRelationship(r, entitiesByName, warnings))
    .filter((r): r is OSIRelationship => r !== undefined);

  const semanticModel: OSISemanticModel = {
    name: model.pkg,
    datasets,
  };
  if (relationships.length) semanticModel.relationships = relationships;

  return {
    document: { version: OSI_VERSION, semantic_model: [semanticModel] },
    warnings,
  };
}
