/**
 * Schema validation helpers.
 *
 * - OSI output (import) is validated against `schemas/osi-schema.json`
 *   (JSON Schema draft 2020-12 -> Ajv2020).
 * - Semarchy output (export) is validated per object against the matching
 *   `schemas/<Type>.json` (draft-07 -> default Ajv).
 *
 * Best-effort: if a schema file is missing, validation is skipped with a
 * warning rather than failing.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { SemarchyModel, SemarchyObject } from "./semarchy-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = resolve(__dirname, "..", "schemas");

export const OSI_SCHEMA_PATH = join(SCHEMAS_DIR, "osi-schema.json");

export interface ValidationOutcome {
  valid: boolean;
  errors: string[];
  skipped: boolean;
}

function loadSchema(path: string): object | undefined {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}

/** Validate the OSI document against the 2020-12 OSI schema. */
export function validateOsi(document: unknown): ValidationOutcome {
  const schema = loadSchema(OSI_SCHEMA_PATH);
  if (!schema) {
    return { valid: true, skipped: true, errors: [`schema not found: ${OSI_SCHEMA_PATH}`] };
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(document) as boolean;
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim(),
  );
  return { valid, skipped: false, errors };
}

/** Validate every mapped Semarchy object against its per-type draft-07 schema. */
export function validateSemarchy(model: SemarchyModel): ValidationOutcome {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const errors: string[] = [];
  let checked = 0;

  const objects: SemarchyObject[] = [
    ...model.entities,
    ...model.uniqueKeys,
    ...model.references,
    ...model.enrichers,
  ];
  for (const obj of objects) {
    const schema = loadSchema(join(SCHEMAS_DIR, `${obj._type}.json`));
    if (!schema) continue;
    checked++;
    const validate = ajv.compile(schema);
    // Store the result: Ajv's ValidateFunction is a type guard, and letting it
    // narrow `obj` in the negative branch would collapse it to `never`.
    const ok: boolean = validate(obj);
    if (!ok) {
      for (const e of validate.errors ?? []) {
        errors.push(
          `${obj._type} ${obj._name ?? ""}: ${e.instancePath || "/"} ${e.message ?? ""}`.trim(),
        );
      }
    }
  }

  if (checked === 0) {
    return { valid: true, skipped: true, errors: ["no Semarchy schemas found"] };
  }
  return { valid: errors.length === 0, skipped: false, errors };
}
