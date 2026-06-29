---
name: bumping-the-osi-version
description: Use when releasing or bumping the OSI specification version (e.g. 0.2.0.dev0 -> 0.2.0) — propagating the new version across every site it is hardcoded (the pyproject.toml files, the spec.md/spec.yaml headers, the osi-schema.json and ontology.json version consts, examples, test fixtures, docs), appending changelog entries, and re-validating. Leaves the Java converters' separate artifact versions alone.
---

# bumping-the-osi-version

## Overview

The OSI spec version is duplicated as a **literal across ~two dozen sites in many files** — there is
no single source of truth (`version.txt` does not exist). Two of those sites are JSON-Schema
`const`s (`core-spec/osi-schema.json` and `ontology/ontology.json`), and every example and test
fixture must carry exactly that version, so **the version is coupled to validation** — bump the
const without bumping the models and validation fails. This skill propagates a bump to every site,
handles changelogs correctly, leaves unrelated version schemes alone, and re-validates.

## Inputs

- **Required:** the new version and the current version it replaces.
- **Optional:** whether this is a real release (mark the old "(Unreleased)" changelog entry released)
  or a dev bump. The script auto-detects the current version from the schema `const` if not given.

## Workflow

1. **Find every site:** `bash "${CLAUDE_SKILL_DIR}/scripts/version-sites.sh"` (read-only) lists all
   occurrences of the current version, and separately flags the Java artifact versions to leave
   alone. See `references/version-sites.md` for the categorized file list.
2. **Replace the version at every value site:** the three `pyproject.toml` `version = "…"` (plus the
   dbt `osi-python>=…` lower bound), the `spec.md` `**Version:**` header and `spec.yaml` `version:`,
   the `const` in **both** `osi-schema.json` and `ontology.json`, the `version:` in every
   `examples/*.yaml` and the gooddata + salesforce test fixtures, and the version strings in
   `docs/index.md`, the salesforce README, and the `ontology.md` header.
3. **Append changelog entries — don't overwrite history.** In `spec.md` and `ontology.md` the
   changelog lists past versions with dates/notes; add a **new** entry (and on a real release, mark
   the prior "(Unreleased)" line as released) rather than rewriting existing lines.
4. **Leave the Java artifact versions alone:** `converters/polaris` and `converters/salesforce`
   `pom.xml` are `0.1.0-SNAPSHOT` — they version the converter jars, not the OSI spec.
5. **Re-validate:** every example/fixture must satisfy the bumped schema `const`. Run
   `../syncing-a-spec-change/scripts/validate-examples.sh` (or `validation/validate.py` per file);
   all must pass.
6. **Confirm nothing was missed:** re-run `version-sites.sh` — no occurrences of the **old** version
   should remain except the intentional historical changelog entries.

## Guidelines

- **Const coupling:** `osi-schema.json` governs semantic-model examples/fixtures; `ontology.json`
  governs ontology docs (`examples/flights.yaml`). Each const and its models move together.
- **Value sites vs history:** version *values* (headers, consts, model `version:`, package versions)
  get bumped; changelog/historical lines get a new entry appended, never a blind replace.
- **Separate schemes stay put:** the Java `0.1.0-SNAPSHOT` artifact versions are unrelated.
- This skill changes *only* the version. A change to the spec's shape is the `syncing-a-spec-change`
  skill's job.

## Output

- The new version present at every value site; the old version remaining only in intentional
  changelog history.
- New changelog entries in `spec.md` and `ontology.md`.
- All examples/fixtures re-validating against the bumped schemas.

## Common mistakes

- Blanket find-and-replace that rewrites changelog history or the Java `0.1.0-SNAPSHOT` versions.
- Bumping a schema `const` but not the matching example/fixture `version:` (or vice versa) — breaks validation.
- Missing one of the scattered sites — always reconcile against `version-sites.sh`.
- Forgetting the ontology side (`ontology.json` const + `examples/flights.yaml`).
