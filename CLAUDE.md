# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

OSI (Open Semantic Interchange) is a **specification project**, not a single application. The
spec in `core-spec/` is the source of truth; everything else exists to validate models against it
or convert between OSI and other semantic formats. There is no top-level build — each sub-project
under `converters/` and `python/` is independent, with its own toolchain, version, and tests.

Current spec version is `0.2.0.dev0` (draft — the schema may still change before 0.2.0 is released).

## Repository layout

- `core-spec/` — the canonical artifacts: `spec.md` (human-readable), `spec.yaml` / `osi-schema.json`
  (machine-readable JSON Schema). **`osi-schema.json` is the schema everything validates against.**
- `ontology/` — a *separate* specification (`ontology.md`, `ontology.json`) for ontology/concept
  mappings. Do not confuse `ontology/ontology.json` with `core-spec/osi-schema.json`; they describe
  different things.
- `examples/` — reference OSI models (`tpcds_semantic_model.yaml` is the complete one).
- `validation/validate.py` — standalone validator.
- `python/` — `osi-python`, the shared Pydantic types package other Python converters depend on.
- `converters/` — reference converters (dbt, gooddata, snowflake in Python; polaris, salesforce in Java).

## Validation

The validator checks four things, in this order: JSON Schema (structure/types/enums), unique names
(datasets, fields, metrics, relationships), valid relationship references, and SQL syntax (via
`sqlglot`, mapping OSI dialects to sqlglot dialects). `sqlglot` is optional — SQL checks are skipped
if it is not installed.

```bash
pip install pyyaml jsonschema sqlglot
python validation/validate.py examples/tpcds_semantic_model.yaml
# defaults to core-spec/osi-schema.json; override with:
python validation/validate.py <model.yaml> --schema <schema.json>
```

## Converters

Each converter is its own buildable/testable unit. `cd` into the directory first.

**`python/` (osi-python)** — shared types, depended on by the dbt converter.
```bash
cd python && uv sync && uv run pytest
```

**`converters/dbt` (osi-dbt)** — bidirectional dbt MetricFlow Semantic Interface (MSI) ↔ OSI.
Has a CLI entry point `osi-dbt` with `msi-to-osi` / `osi-to-msi` subcommands. Tests use `syrupy` snapshots.
```bash
cd converters/dbt && uv sync && uv run pytest
osi-dbt msi-to-osi -i target/semantic_manifest.json -o semantic_model.yaml
```

**`converters/gooddata` (gooddata-osi)** — bidirectional GoodData LDM ↔ OSI. Library API only
(no CLI). Linted with `ruff` (line-length 120). Metrics are intentionally *not* converted (MAQL is
context-aware and can't map to OSI's SQL-expression metric model).
```bash
cd converters/gooddata && uv sync --group dev && uv run pytest && uv run ruff check .
```

**`converters/snowflake`** — one-way OSI → Snowflake Cortex Analyst. Plain script + requirements.txt.
```bash
cd converters/snowflake && pip3 install -r requirements.txt
python3 src/osi_to_snowflake_yaml_converter.py -i input.yaml -o output.yaml
python3 -m pytest tests/
```

**`converters/polaris`** — Java/Maven, bidirectional OSI ↔ Apache Polaris (Iceberg REST Catalog).
Requires Java 11+. Talks to a live Polaris server over the network.
```bash
cd converters/polaris && mvn clean package
mvn test                                   # run tests
mvn test -Dtest=OsiPolarisConverterTest    # single test class
java -jar target/osi-polaris-converter-0.1.0-SNAPSHOT.jar import|export ...
```

**`converters/salesforce`** — Java/Maven, lossless bidirectional OSI ↔ Salesforce Semantic Model.
Requires Java 17+. **Build will fail unless both schemas are present** under
`src/main/resources/schemas/` (`osi-schema.json` and `salesforce-semantic-model-schema.json`) — they
must be fetched manually before `mvn package` because they get bundled into the jar. Mapping is
config-driven via `mappings.yaml` and `osi-salesforce-converter-config.yaml` in resources, executed
by a generic handler pipeline (`converter/pipeline/`, `GenericMappingEngine`).
```bash
cd converters/salesforce && mvn clean package
mvn test -Dtest=OsiToSalesforceConverterTest   # single test class
java -jar target/osi-salesforce-converter-0.1.0-SNAPSHOT.jar toOSI|toSalesforce <input>
```

## Conventions worth knowing

- Converters that hit external systems (polaris) vs. pure offline file converters (snowflake, dbt,
  gooddata, salesforce) — only polaris needs a running server.
- Vendor-specific concepts that don't fit the OSI core are preserved through OSI `custom_extensions`
  rather than dropped (see gooddata's label/geo/date handling). When a concept genuinely can't be
  represented, the convention is to drop it and emit a warning to stderr, never fail silently.
- Python sub-projects target 3.11+ (gooddata: 3.12+) and use `uv` with hatchling builds.

## Contributing

Spec changes (`core-spec/`) follow a formal proposal → 7-day discussion → TSC vote process
(see CONTRIBUTING.md); all other changes go through standard PR review. Keep spec edits to `spec.md`,
`spec.yaml`, and `osi-schema.json` in sync — and when the change affects the model shape, also update
`python/src/osi/models.py` (the canonical Pydantic types the Python converters import) and any
affected `examples/`, then re-run the validator on them.
