---
name: implementing-a-new-converter
description: Use when adding a new OSI converter for a vendor (e.g. Snowflake, dbt, Databricks, a BI tool) — scaffolding the project, implementing the bidirectional import/export mapping, and wiring up tests. Covers the hub-and-spoke model, the dialect-fallback and custom_extensions preservation rules, registering the vendor in the spec, and verifying with roundtrip tests on the TPC-DS baseline.
---

# implementing-a-new-converter

## Overview

OSI converters are **spokes in a hub-and-spoke model**: OSI is the neutral hub, and each converter
is a *bidirectional* spoke between OSI and one vendor format — **export** (OSI → Vendor) and
**import** (Vendor → OSI). The fastest correct path is to copy the existing converter closest to
your language/style, then follow the documented per-construct mapping. The cardinal rule is **never
lose information**: anything without an OSI core equivalent goes into `custom_extensions` so
roundtrips (`Vendor → OSI → Vendor`) stay faithful.

## Inputs

- **Required:** the target vendor and its semantic format; the language/style — Python CLI,
  Python library, plain Python script, or Java/Maven.
- **Optional:** which direction to build first (export or import).

## Workflow

1. **Scaffold from the closest existing converter.** Run
   `bash "${CLAUDE_SKILL_DIR}/scripts/converter-starter.sh" <style>` to get the reference converter
   to copy plus its build/test/run commands. Copy that converter's structure
   (`pyproject.toml`/`pom.xml`, `src/` layout, `README.md`, `tests/`) into `converters/<vendor>/`
   and rename. Add the vendor to the **Supported Vendors** table in `converters/index.md`.
2. **Register the vendor in the spec** if it's new: add it to the vendor/`Dialect` enums and define
   its `custom_extensions` schema. Use the **`syncing-a-spec-change`** skill to propagate that
   across `spec.md` / `spec.yaml` / `osi-schema.json`.
3. **Implement export (OSI → Vendor)** per the 9-step guide: validate input with
   `validation/validate.py`, parse the `semantic_model` entries, map datasets / fields /
   relationships / metrics using the **dialect-fallback chain**, apply matching `custom_extensions`,
   preserve `ai_context`, then validate the output against the vendor's own schema/tooling. Full
   per-construct mapping tables, edge cases, and roundtrip rules are in
   `references/converter-guide.md`.
4. **Implement import (Vendor → OSI):** produce a model that passes `validation/validate.py`;
   capture vendor metadata with no OSI equivalent into `custom_extensions`.
5. **Write tests** with the **`create-tests`** skill, using `examples/tpcds_semantic_model.yaml` as
   the baseline, and add a **roundtrip test** (`Vendor → OSI → Vendor`).
6. **Document limitations** (unsupported constructs, lossy mappings) in the converter's `README.md`.

## Guidelines

- **Dialect selection:** prefer the vendor dialect → fall back to `ANSI_SQL` → warn/error if neither.
- **Never discard silently:** preserve `custom_extensions` for **all** vendors, not just the target,
  so one model can carry several vendors' metadata and roundtrip cleanly.
- **Composite keys:** `from_columns`/`to_columns` correspond positionally — preserve order.
- **`ai_context`** appears at every level (model, dataset, field, relationship, metric); map it, or
  stash it in a `custom_extension` with `vendor_name: COMMON` to avoid loss.
- **Offline by default** (like dbt/gooddata/snowflake/salesforce); only contact a live service if
  the vendor genuinely requires it (like polaris), and keep the parse/generate logic unit-testable.

## Output

- A bidirectional converter under `converters/<vendor>/` mirroring an existing converter's
  structure, listed in `converters/index.md`.
- Tests (including a roundtrip) passing on the TPC-DS baseline.
- Documented limitations, and the vendor registered in the spec.

## Common mistakes

- Building only one direction (export *or* import).
- Dropping non-target `custom_extensions` — silently breaks roundtrip fidelity.
- Hardcoding a single dialect instead of the fallback chain.
- Forgetting to register the new vendor in the spec (an orphaned `vendor_name`).
- Reinventing test setup instead of using `create-tests` + the TPC-DS baseline.
