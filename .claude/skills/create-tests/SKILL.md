---
name: create-tests
description: Use when asked to write, create, add, or generate tests for code in the OSI repository — for any of its sub-projects (python, converters/dbt, converters/gooddata, converters/snowflake, converters/polaris, converters/salesforce). Detects the sub-project, follows its exact test framework/location/fixture conventions, reuses existing fixtures and helpers, and runs the tests to verify.
---

# create-tests

## Overview

OSI is a multi-language monorepo where every sub-project tests differently — pytest, pytest +
syrupy snapshots, pytest + conftest fixtures, and JUnit 5 / Maven — each with its own test
directory, file-naming rule, fixtures, and run command. This skill generates tests that match the
target's sub-project exactly: it **reuses that sub-project's existing fixtures and helpers instead
of inventing parallel ones**, places the test where the sub-project expects it, and runs the tests
to confirm they pass.

## Inputs

- **Required:** the source file or module to generate tests for — a path inside an OSI sub-project.
- **Optional:** which behaviors/cases to cover; otherwise infer them from the source and the
  sub-project's existing tests.

## Workflow

1. **Identify the sub-project.** Resolve the target source file/module, then run:
   ```bash
   bash "${CLAUDE_SKILL_DIR}/scripts/project-info.sh" <path-to-source-file>
   ```
   It prints the sub-project, framework, test directory, file-naming rule, fixtures location, run
   command, and single-test command. If the path is outside any known sub-project it exits non-zero.

2. **Study before writing.** Read 1–2 existing test files **and** the sub-project's shared
   fixtures/helpers to match style. Reuse what already exists — do **not** create parallel fixtures:
   - `converters/dbt` → builder functions in `tests/helpers.py` (`_manifest()`, `_simple_metric()`, …)
   - `converters/gooddata` → `tests/conftest.py` fixtures + `tests/fixtures/*.json|*.yaml`
   - `converters/snowflake` → inline helpers (`_wrap_osi()`, `_minimal_model()`)
   - `converters/salesforce` → input files under `src/test/resources/examples/`
   - `converters/polaris` → inline `private static final String` YAML constants
   For full per-sub-project skeletons and details, read
   `${CLAUDE_SKILL_DIR}/references/conventions.md`.

3. **Write the test** in the correct directory with the correct naming (`test_*.py` for Python,
   `*Test.java` for Java). Any inline OSI model must use the canonical envelope
   (`version: "0.2.0.dev0"`, then `semantic_model:`).

4. **Run and verify** with the sub-project's command from step 1; fix failures until green. For
   **dbt**, snapshot assertions (`== snapshot`) need `uv run pytest --snapshot-update` on the first
   run to generate `.ambr` snapshots, then a plain `uv run pytest` to confirm they match.

The per-sub-project framework, paths, naming, fixtures, and run/single-test commands come from
`project-info.sh` (step 1); the full table with code skeletons is in `references/conventions.md`.

## Gotchas

- **All converters are offline except `polaris`**, which talks to a live Polaris server. Prefer unit
  tests of the parser/generator (`OsiModelParser`, `OsiYamlGenerator`) over tests that need a
  running catalog.
- **`salesforce` tests `assumeTrue()`-skip** unless both schemas exist under
  `src/main/resources/schemas/` (`osi-schema.json`, `salesforce-semantic-model-schema.json`). Mirror
  that guard with `@BeforeAll` + `assumeTrue(...)` so the suite degrades gracefully.
- **Prefer roundtrip tests** (A → OSI → A) for bidirectional converters, mirroring gooddata's
  `test_roundtrip.py`.

## Output

- One or more test files in the sub-project's correct directory and naming convention.
- A passing run of that sub-project's test command (with snapshots generated for dbt where needed).
- A short summary of what was added and the exact command to re-run the tests.

## Common mistakes

- Wrong test directory or naming (e.g. `*Tests.java`, or Python tests outside `tests/`).
- Duplicating a fixture/helper that already exists in the sub-project.
- Forgetting `--snapshot-update` on the first dbt run, so new snapshot tests error as "no snapshot".
- Writing live-server tests for polaris instead of parser/generator unit tests.
- Omitting the `version: "0.2.0.dev0"` / `semantic_model:` envelope from inline OSI models.
