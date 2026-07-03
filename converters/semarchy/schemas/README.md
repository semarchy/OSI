# Schemas

This directory bundles the JSON Schemas the converter validates against. Both
files are fetched/copied manually and are **required for full validation** (the
converter degrades to skip-with-warning if they are absent).

| File | Purpose | How to obtain |
|------|---------|---------------|
| `osi-schema.json` | Validate OSI output on import (Semarchy → OSI). | Copy from `core-spec/osi-schema.json`. |
| `semarchy-semantic-model-schema.json` | Validate Semarchy output on export (OSI → Semarchy). | **PENDING** — provide the Semarchy semantic-model JSON Schema. |

Once `semarchy-semantic-model-schema.json` is present, replace the placeholder
types in `src/semarchy-types.ts` with the real constructs and complete the
mapping in `src/osi-to-semarchy.ts` and `src/semarchy-to-osi.ts`.
