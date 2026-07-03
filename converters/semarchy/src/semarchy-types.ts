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

/** Data types Semarchy treats as time/temporal (drive OSI `dimension.is_time`). */
export const TIME_DATA_TYPES: ReadonlySet<string> = new Set([
  "Date",
  "Timestamp",
]);

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
  /** `_name` of the attribute acting as primary key. */
  primaryKey?: string;
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
  /** Many-side entity `_name`. */
  fromEntity: string;
  /** One-side entity `_name`. */
  toEntity: string;
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
 * grouped by type, plus the package name shared by its objects.
 */
export interface SemarchyModel {
  pkg: string;
  entities: SemarchyEntity[];
  references: SemarchyReference[];
  uniqueKeys: SemarchyUniqueKey[];
}
