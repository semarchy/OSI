/**
 * Schema validation helpers.
 *
 * - Semarchy output is validated against the Semarchy JSON Schema (guide step 9),
 *   once it is present under `schemas/`.
 * - OSI output is validated against `osi-schema.json` (guide step 1 analogue).
 *
 * Both are best-effort: if a schema file is not found, validation is skipped
 * with a warning rather than failing, so the scaffold is usable before the
 * Semarchy schema is dropped in.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Ajv from "ajv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = resolve(__dirname, "..", "schemas");

export const SEMARCHY_SCHEMA_PATH = resolve(
  SCHEMAS_DIR,
  "semarchy-semantic-model-schema.json",
);
export const OSI_SCHEMA_PATH = resolve(SCHEMAS_DIR, "osi-schema.json");

export interface ValidationOutcome {
  valid: boolean;
  errors: string[];
  skipped: boolean;
}

function validateAgainst(schemaPath: string, data: unknown): ValidationOutcome {
  if (!existsSync(schemaPath)) {
    return {
      valid: true,
      skipped: true,
      errors: [`schema not found, validation skipped: ${schemaPath}`],
    };
  }
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(data) as boolean;
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim(),
  );
  return { valid, skipped: false, errors };
}

export function validateSemarchy(model: unknown): ValidationOutcome {
  return validateAgainst(SEMARCHY_SCHEMA_PATH, model);
}

export function validateOsi(document: unknown): ValidationOutcome {
  return validateAgainst(OSI_SCHEMA_PATH, document);
}
