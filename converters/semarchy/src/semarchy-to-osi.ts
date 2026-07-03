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
import { isTimeDataType } from "./semarchy-types.js";
import type {
  SemarchyEnricher,
  SemarchyEntity,
  SemarchyModel,
  SemarchyReference,
} from "./semarchy-types.js";

/** Last dot-separated segment of a Semarchy fully-qualified name. */
function localName(fqn: string): string {
  const parts = fqn.split(".");
  return parts[parts.length - 1] ?? fqn;
}

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
  if (isTimeDataType(String(attr.dataType))) {
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
    // Qualify the physical table with the model's root package.
    source: `${model.pkg}.${entity.physicalTableName}`,
    fields: entity.attributes.map((a) => attributeToField(a)),
  };

  const description = entity.description ?? entity.documentation;
  if (description) dataset.description = description;
  // primaryKey is a FQN (`Pkg.entities.X.X.attr`); take the attribute name.
  if (entity.primaryKey) dataset.primary_key = [localName(entity.primaryKey)];

  const uniqueKeys = model.uniqueKeys
    .filter((uk) => localName(uk.entity) === entity._name)
    .map((uk) => uk.keyAttributes.map((k) => localName(k.attribute)));
  if (uniqueKeys.length) dataset.unique_keys = uniqueKeys;

  return dataset;
}

function referenceToRelationship(
  ref: SemarchyReference,
  entitiesByName: Map<string, SemarchyEntity>,
  warnings: string[],
): OSIRelationship | undefined {
  // fromEntity/toEntity are FQNs; resolve by local (last-segment) name.
  const toEntity = entitiesByName.get(localName(ref.toEntity));
  const toColumn = toEntity?.primaryKey && localName(toEntity.primaryKey);
  if (!toColumn) {
    warnings.push(
      `[drop] reference "${ref._name}": cannot resolve primary key of ` +
        `to-entity "${ref.toEntity}"; relationship skipped`,
    );
    return undefined;
  }
  // Semarchy expresses the FK implicitly; the foreign attribute on the many side
  // is the best available "from" column, else the role name.
  const fromColumn = ref.foreignAttribute?._name ?? ref.toRoleName;
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
    from: localName(ref.fromEntity),
    to: localName(ref.toEntity),
    from_columns: [fromColumn],
    to_columns: [toColumn],
  };
}

/**
 * Apply a SemQL enricher onto the OSI datasets: each `{attributeName,
 * expression}` adds a SEMARCHY dialect entry to the matching field (keeping its
 * ANSI_SQL column reference), turning it into a computed field. If no field
 * matches, a SEMARCHY-only field is created. The enricher-level `condition` has
 * no OSI equivalent and is dropped with a warning.
 */
function applyEnricher(
  enricher: SemarchyEnricher,
  datasetsByName: Map<string, OSIDataset>,
  warnings: string[],
): void {
  const dataset = datasetsByName.get(localName(enricher.entity));
  if (!dataset) {
    warnings.push(
      `[drop] enricher "${enricher._name}": entity "${enricher.entity}" not found`,
    );
    return;
  }
  if (enricher.condition) {
    warnings.push(
      `[drop] enricher "${enricher._name}": SemQL condition has no OSI ` +
        `equivalent and is dropped`,
    );
  }
  dataset.fields ??= [];
  for (const { attributeName, expression } of enricher.semQlEnricherExpressions) {
    const name = localName(attributeName);
    const semarchy = { dialect: "SEMARCHY" as const, expression };
    const field = dataset.fields.find((f) => f.name === name);
    if (field) {
      // Replace any prior SEMARCHY entry, keep other dialects (e.g. ANSI_SQL).
      field.expression.dialects = [
        ...field.expression.dialects.filter((d) => d.dialect !== "SEMARCHY"),
        semarchy,
      ];
    } else {
      warnings.push(
        `[warn] enricher "${enricher._name}": attribute "${name}" is not an ` +
          `entity attribute; creating a computed-only field`,
      );
      dataset.fields.push({ name, expression: { dialects: [semarchy] } });
    }
  }
}

/** Convert a grouped Semarchy model into an OSI document. */
export function semarchyToOsi(
  model: SemarchyModel,
  warnings: string[] = [],
): ImportResult {
  const entitiesByName = new Map(model.entities.map((e) => [e._name, e]));

  const datasets = model.entities.map((e) => entityToDataset(e, model));
  const datasetsByName = new Map(datasets.map((d) => [d.name, d]));
  for (const enricher of model.enrichers) {
    applyEnricher(enricher, datasetsByName, warnings);
  }

  const relationships = model.references
    .map((r) => referenceToRelationship(r, entitiesByName, warnings))
    .filter((r): r is OSIRelationship => r !== undefined);

  const semanticModel: OSISemanticModel = {
    name: model.name,
    datasets,
  };
  if (relationships.length) semanticModel.relationships = relationships;

  return {
    document: { version: OSI_VERSION, semantic_model: [semanticModel] },
    warnings,
  };
}
