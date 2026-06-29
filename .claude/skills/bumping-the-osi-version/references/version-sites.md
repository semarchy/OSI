# OSI version sites

Reference for the `bumping-the-osi-version` skill. The OSI spec version is a literal with no single
source of truth, so a bump means editing every site below. Always reconcile against the live output
of `scripts/version-sites.sh` (the repo changes); this list is the categorized map.

## Why it's coupled to validation

`core-spec/osi-schema.json` and `ontology/ontology.json` each declare `version` as a JSON-Schema
`const`. Any model validated against a schema must carry that exact version. So:

- Bump `osi-schema.json`'s const **and** every semantic-model `version:` together
  (`examples/tpcds_semantic_model.yaml`, `converters/gooddata/tests/fixtures/osi_tpcds.yaml`,
  `converters/salesforce/src/test/resources/examples/osiToSalesforce.yaml`).
- Bump `ontology/ontology.json`'s const **and** every ontology doc's `version:`
  (`examples/flights.yaml`).

Bumping one side but not the other makes validation fail — which is exactly what step 5's
re-validation catches.

## Value sites — bump the version literal

| File | Site |
| :--- | :--- |
| `python/pyproject.toml` | `version = "…"` |
| `converters/dbt/pyproject.toml` | `version = "…"` **and** the `osi-python>=…` dependency lower bound |
| `converters/gooddata/pyproject.toml` | `version = "…"` |
| `core-spec/spec.md` | `**Version:**` header (near top) |
| `core-spec/spec.yaml` | `version:` (near top) |
| `core-spec/osi-schema.json` | the `version` property `const` |
| `ontology/ontology.json` | the `version` property `const` |
| `ontology/ontology.md` | `**Version:**` header |
| `examples/tpcds_semantic_model.yaml` | `version:` (semantic-model) |
| `examples/flights.yaml` | `version:` (ontology doc) |
| `converters/gooddata/tests/fixtures/osi_tpcds.yaml` | `version:` |
| `converters/salesforce/src/test/resources/examples/osiToSalesforce.yaml` | `version:` |
| `converters/salesforce/README.md` | "Supports OSI Specification v…" |
| `docs/index.md` | "current version: **…**" |

## Append, don't replace — changelog/historical lines

| File | Line | Action |
| :--- | :--- | :----- |
| `core-spec/spec.md` | the version-history list (e.g. "**X** (Unreleased): …") | Add a new entry; on a real release, mark the prior "(Unreleased)" as released. Don't rewrite older entries. |
| `ontology/ontology.md` | the dated version-history list (e.g. "**X** (YYYY-MM-DD): …") | Add a new dated entry; leave historical entries intact. |

## Leave alone — separate version schemes

| File | Value | Why |
| :--- | :--- | :-- |
| `converters/polaris/pom.xml` | `0.1.0-SNAPSHOT` | Versions the converter **jar**, not the OSI spec. |
| `converters/salesforce/pom.xml` | `0.1.0-SNAPSHOT` | Same — independent artifact version. |

## Lower priority — instructional mentions

`CLAUDE.md` and the `.claude/skills/*` references mention the version inside examples/instructions.
They don't affect build or validation; update them if you want the docs to read current, but they
aren't part of the release surface. (`version-sites.sh` lists them too, so you can decide.)

## Verify

```bash
bash "${CLAUDE_SKILL_DIR}/../syncing-a-spec-change/scripts/validate-examples.sh"
```

Validates every example/fixture against the (now bumped) schemas. All must pass. Then re-run
`version-sites.sh` and confirm the only remaining old-version hits are the intentional changelog
history lines.
