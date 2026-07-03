/**
 * TypeScript types for the OSI core model.
 *
 * Mirrors `python/src/osi/models.py` (the canonical Pydantic types) and
 * `core-spec/osi-schema.json`. Keep in sync when the spec changes.
 */

/** Supported SQL and expression language dialects (core-spec Dialect enum). */
export type OSIDialect =
  | "ANSI_SQL"
  | "SNOWFLAKE"
  | "MDX"
  | "TABLEAU"
  | "DATABRICKS"
  | "MAQL"
  | "SEMARCHY";

/**
 * Vendor name for custom extensions. The spec accepts any string, but these are
 * the well-known values. Use "SEMARCHY" for this converter and "COMMON" for
 * cross-vendor metadata (e.g. ai_context that a vendor cannot represent).
 */
export type OSIVendor =
  | "COMMON"
  | "SNOWFLAKE"
  | "SALESFORCE"
  | "DBT"
  | "DATABRICKS"
  | "GOODDATA"
  | "SEMARCHY"
  | (string & {});

export interface OSIAIContextObject {
  instructions?: string;
  synonyms?: string[];
  examples?: string[];
}

/** ai_context is either a bare string or a structured object. */
export type OSIAIContext = string | OSIAIContextObject;

/** Vendor-specific metadata carried as a serialized JSON string in `data`. */
export interface OSICustomExtension {
  vendor_name: OSIVendor;
  /** JSON string containing vendor-specific data. */
  data: string;
}

export interface OSIDialectExpression {
  dialect: OSIDialect;
  expression: string;
}

export interface OSIExpression {
  dialects: OSIDialectExpression[];
}

export interface OSIDimension {
  is_time?: boolean;
}

export interface OSIField {
  name: string;
  expression: OSIExpression;
  dimension?: OSIDimension;
  label?: string;
  description?: string;
  ai_context?: OSIAIContext;
  custom_extensions?: OSICustomExtension[];
}

export interface OSIDataset {
  name: string;
  /** `database.schema.table` style source reference. */
  source: string;
  primary_key?: string[];
  unique_keys?: string[][];
  description?: string;
  ai_context?: OSIAIContext;
  fields?: OSIField[];
  custom_extensions?: OSICustomExtension[];
}

export interface OSIRelationship {
  name: string;
  /** Many-side dataset (serialized as `from` in YAML/JSON). */
  from: string;
  /** One-side dataset. */
  to: string;
  /** Positionally corresponds to `to_columns`; preserve order. */
  from_columns: string[];
  to_columns: string[];
  ai_context?: OSIAIContext;
  custom_extensions?: OSICustomExtension[];
}

export interface OSIMetric {
  name: string;
  expression: OSIExpression;
  description?: string;
  ai_context?: OSIAIContext;
  custom_extensions?: OSICustomExtension[];
}

export interface OSISemanticModel {
  name: string;
  description?: string;
  ai_context?: OSIAIContext;
  datasets: OSIDataset[];
  relationships?: OSIRelationship[];
  metrics?: OSIMetric[];
  custom_extensions?: OSICustomExtension[];
}

export interface OSIDocument {
  version: string;
  dialects?: OSIDialect[];
  vendors?: OSIVendor[];
  semantic_model: OSISemanticModel[];
}

/** The OSI spec version this converter targets. */
export const OSI_VERSION = "0.2.0.dev0";
