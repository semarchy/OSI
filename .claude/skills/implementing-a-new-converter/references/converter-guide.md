# Converter implementation guide

Reference for the `implementing-a-new-converter` skill. The canonical, fuller version lives in
`converters/index.md` — read it for prose and examples; this file is the working checklist.

## Hub-and-spoke

OSI is the neutral hub; each converter is one bidirectional spoke. With N vendors you need 2·N
converters (import + export per vendor), not N·(N−1) point-to-point ones. Every converter handles
both directions:

- **Export (OSI → Vendor):** read an OSI model, emit the vendor representation.
- **Import (Vendor → OSI):** read a vendor model, emit a valid OSI model, capturing
  vendor-specific metadata into `custom_extensions`.

## Pick a template (scaffolding)

Copy the existing converter closest to your chosen style, then rename/adapt. `converter-starter.sh`
prints this same mapping plus commands.

| Style | Copy | Shape | Build / test / run |
| :---- | :--- | :---- | :----------------- |
| Python CLI | `converters/dbt` | `uv` + hatchling; `[project.scripts]` entry with subcommands; depends on `osi-python`; syrupy snapshot tests | `uv sync && uv run pytest`; CLI `osi-dbt <subcmd> -i … -o …` |
| Python library | `converters/gooddata` | `uv` + hatchling; library API (no CLI); ruff; `conftest.py` fixtures | `uv sync --group dev && uv run pytest && uv run ruff check .` |
| Plain Python script | `converters/snowflake` | no `pyproject`; `requirements.txt`; `argparse` `-i/-o` script under `src/` | `pip3 install -r requirements.txt && python3 -m pytest tests/` |
| Java / Maven | `converters/salesforce` (offline) or `converters/polaris` (live service) | Maven; executable jar with subcommands; JUnit 5 | `mvn clean package && mvn test`; `java -jar target/*.jar <subcmd> …` |

All carry `version: "0.2.0.dev0"` in the OSI envelope of any model they emit.

## Per-construct mapping (export)

| OSI construct | What to map | Notes |
| :------------ | :---------- | :---- |
| Semantic model | `name`, `description`, `ai_context`, `datasets`, `relationships`, `metrics`, `custom_extensions` | Top-level container → vendor root object. |
| Dataset | `name`, `source`, `primary_key`, `unique_keys`, `fields`, `ai_context` | Parse `source` (`database.schema.table`) into the vendor's catalog structure. |
| Field | `name`, `expression.dialects`, `dimension.is_time`, `label`, `description`, `ai_context` | Select dialect via the fallback chain; map time-dimension markers. |
| Relationship | `name`, `from`, `to`, `from_columns`, `to_columns` | Positional column correspondence; `from` = many-side, `to` = one-side; multi-column join for composite keys. |
| Metric | `name`, `expression.dialects`, `description`, `ai_context` | Resolve dataset references (`store_sales.ss_ext_sales_price`) into qualified vendor columns; ensure needed joins exist. |
| Custom extensions | entries where `vendor_name` == target | Parse the `data` JSON and apply; **keep every other vendor's entries untouched**. |
| AI context | string or `{instructions, synonyms, examples}` | Map where supported; else stash in a `custom_extension` (`vendor_name: COMMON`). |

## The 9-step export procedure (from `converters/index.md`)

1. Validate input with `validation/validate.py` (against `core-spec/osi-schema.json`).
2. Parse the OSI model; iterate top-level `semantic_model` entries.
3. Map datasets (name, source→catalog, primary/unique keys, fields).
4. Map fields with **dialect selection**: vendor dialect → `ANSI_SQL` → warn/error.
5. Map relationships into vendor joins; preserve composite-key ordering.
6. Map metrics with the same dialect logic; resolve cross-dataset references.
7. Apply `custom_extensions` matching the target `vendor_name`.
8. Preserve `ai_context` as vendor-equivalent annotations.
9. Validate output against the vendor's own schema/tooling.

## Edge cases

| Scenario | Approach |
| :------- | :------- |
| Missing vendor dialect for a field/metric | Fall back to `ANSI_SQL`; log a warning. |
| Computed field needs vendor SQL syntax | Require the vendor dialect in the source; error if neither vendor nor ANSI present. |
| Composite primary keys | Ensure vendor supports them; otherwise flatten or document the limitation. |
| Cross-dataset metric | Ensure referenced datasets exist and relationships are defined; resolve qualified names. |
| `custom_extension` for an unknown vendor | Keep it — never discard (roundtrip). |
| `ai_context` on a vendor that lacks it | Store in a `custom_extension` (`vendor_name: COMMON`). |

## Roundtrip fidelity (`Vendor → OSI → Vendor`)

- Never discard information silently — no OSI equivalent ⇒ `custom_extensions`.
- Preserve field ordering where the vendor is order-sensitive.
- Preserve `custom_extensions` for **all** vendors, so a model can carry metadata for several at once.

## Contributing checklist (from `converters/index.md`)

1. Add the vendor to the spec enums if new (use the `syncing-a-spec-change` skill).
2. Define the vendor's `custom_extensions` `data` schema.
3. Implement export (OSI → Vendor).
4. Implement import (Vendor → OSI).
5. Add tests using `examples/tpcds_semantic_model.yaml` as the baseline (use the `create-tests` skill).
6. Document limitations/unsupported constructs in the converter README.
