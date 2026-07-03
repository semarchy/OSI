/**
 * TypeScript types for the subset of the Semarchy xDM model this converter maps.
 *
 * Derived from the Semarchy model JSON Schemas (Entity.json, Reference.json,
 * UniqueKey.json). Only the fields the converter reads or writes are typed here;
 * `additionalProperties` on the real schemas allows more. Each object is a
 * separately-serialized, `_type`-discriminated YAML document; a "model" is a
 * directory of such documents (see `io.ts`).
 */

/** Built-in Semarchy attribute data types. */
export type SemarchyBuiltInType =
  | "Binary"
  | "Boolean"
  | "ByteInteger"
  | "Date"
  | "Decimal"
  | "Integer"
  | "LongInteger"
  | "LongText"
  | "ShortInteger"
  | "String"
  | "Timestamp"
  | "UUID";

/**
 * Data types Semarchy treats as time/temporal (drive OSI `dimension.is_time`).
 * Real models use either PascalCase (`Date`) or SCREAMING_SNAKE (`DATE`), so
 * detection is case-insensitive.
 */
const TIME_DATA_TYPES: ReadonlySet<string> = new Set(["DATE", "TIMESTAMP"]);

/** True if a (possibly qualified) Semarchy data type is temporal. */
export function isTimeDataType(dataType: string | undefined): boolean {
  return dataType !== undefined && TIME_DATA_TYPES.has(dataType.toUpperCase());
}

export interface SemarchyEntityAttribute {
  _type: "EntityAttribute";
  _name: string;
  label: string;
  /** UPPER_SNAKE physical column name. */
  physicalName: string;
  dataType: SemarchyBuiltInType | string;
  description?: string;
  documentation?: string;
  length?: number;
  precision?: number;
  scale?: number;
  mandatory?: boolean;
  [key: string]: unknown;
}

export interface SemarchyEntity {
  _type: "Entity";
  _package: string;
  _name: string;
  label: string;
  pluralLabel: string;
  physicalTableName: string;
  entityType: "BASIC" | "FUZZY_MATCHED" | "ID_MATCHED";
  historizeGolden: boolean;
  historizeMaster: boolean;
  attributes: SemarchyEntityAttribute[];
  description?: string;
  documentation?: string;
  /**
   * Fully-qualified reference to the primary-key attribute, e.g.
   * `Pkg.entities.Item.Item.UPC`; the attribute name is the last segment.
   */
  primaryKey?: string;
  [key: string]: unknown;
}

/** Root model object; carries the human model name. */
export interface SemarchyModelObject {
  _type: "Model";
  _package: string;
  _name: string;
  label?: string;
  description?: string;
  [key: string]: unknown;
}

export interface SemarchyKeyAttribute {
  attribute: string;
}

export interface SemarchyUniqueKey {
  _type: "UniqueKey";
  _package: string;
  _name: string;
  label: string;
  /** `_name` of the owning entity. */
  entity: string;
  keyAttributes: SemarchyKeyAttribute[];
  validationLabel: string;
  validationScope: "NONE" | "POST_CONSO" | "PRE_CONSO" | "PRE_POST";
  description?: string;
  [key: string]: unknown;
}

export interface SemarchyReference {
  _type: "Reference";
  _package: string;
  _name: string;
  label: string;
  physicalName: string;
  /** Fully-qualified many-side entity reference (`Pkg.entities.X.X`). */
  fromEntity: string;
  /** Fully-qualified one-side entity reference. */
  toEntity: string;
  /** Foreign attribute on the many side; its `_name` is the FK column. */
  foreignAttribute?: { _name?: string; physicalName?: string; [k: string]: unknown };
  fromRoleLabel: string;
  fromRoleName: string;
  fromRolePluralLabel: string;
  toRoleLabel: string;
  toRoleName: string;
  toRolePhysicalName: string;
  deletePropagation: "CASCADE" | "NULLIFY" | "RESTRICT";
  validationScope: "NONE" | "POST_CONSO" | "PRE_CONSO" | "PRE_POST";
  description?: string;
  [key: string]: unknown;
}

/** Any typed Semarchy object, discriminated by `_type`. */
export type SemarchyObject =
  | SemarchyEntity
  | SemarchyReference
  | SemarchyUniqueKey
  | { _type: string; _name?: string; [key: string]: unknown };

/**
 * A Semarchy model as consumed/produced by this converter: the mapped objects
 * grouped by type, plus the model name/package (from the `Model` object).
 */
export interface SemarchyModel {
  /** Human/logical model name (from the `Model` object), used as the OSI name. */
  name: string;
  /** Root package (from the `Model` object), used to qualify sources. */
  pkg: string;
  /** Root `Model` object (present on export; optional on import). */
  modelObject?: SemarchyModelObject;
  entities: SemarchyEntity[];
  references: SemarchyReference[];
  uniqueKeys: SemarchyUniqueKey[];
}
