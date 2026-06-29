---
name: syncing-a-spec-change
description: Use when changing the OSI core specification — adding or renaming a field, adding an enum value (e.g. a new dialect), or changing a required/cardinality rule. Propagates the change across all four artifacts (spec.md, spec.yaml, osi-schema.json, examples), updates the validator where new semantic rules apply, and re-validates every example.
---

# syncing-a-spec-change

## Overview

The OSI spec is **four representations of the same model that must stay consistent**:
`core-spec/spec.md` (human-readable prose + tables), `core-spec/spec.yaml` (annotated
schema-by-example), `core-spec/osi-schema.json` (the enforceable JSON Schema), and
`examples/*.yaml` (models that must validate against it). A change to one almost always needs the
others. The biggest risk is editing the prose or the schema but not both — the spec silently
diverges and downstream converters break. This skill propagates a change across all of them and
verifies the result.

## Inputs

- **Required:** the spec change to make — the concept involved and what is changing.
- **Optional:** whether it is *additive* (new optional field / new enum value) or *breaking*
  (rename, or newly-required field) — this determines how examples and the validator must change.

## Workflow

1. **Locate the concept across artifacts.** Find its prose row/section in `spec.md`, its
   field/enum in `spec.yaml`, and its property/`$defs` entry in `osi-schema.json`. See
   `references/spec-artifacts.md` for the map of where each concept lives and per-change-type
   checklists.
2. **Apply the change to all three core artifacts in lockstep:**
   - `spec.md` — the prose table/section, plus any inline YAML example.
   - `spec.yaml` — the annotated field or enum entry (keep the explanatory comment).
   - `osi-schema.json` — the JSON Schema constraint (`$defs`, `enum`, `required`,
     `additionalProperties: false` means new fields must be declared).
3. **Update the validator** only if the change adds a rule the JSON Schema can't express:
   `validation/validate.py` — `DIALECT_MAP` for a new dialect; `validate_unique_names` /
   `validate_references` / `validate_sql` for new structural rules.
4. **Update examples.** Exercise the change in `examples/*.yaml`; a newly-**required** field must be
   added to **every** example or validation fails.
5. **Verify:** `bash "${CLAUDE_SKILL_DIR}/scripts/validate-examples.sh"` runs the validator over
   every example against the schema. All must pass before you're done.

## Guidelines

| Artifact | Role | Update when |
| :------- | :--- | :---------- |
| `spec.md` | Human contract (tables, prose, examples) | Always |
| `spec.yaml` | Annotated schema-by-example | Always |
| `osi-schema.json` | Machine-enforced JSON Schema (Draft 2020-12) | Always — it's what converters/validator check |
| `examples/*.yaml` | Conformance fixtures | When shape changes; always for new required fields |
| `validation/validate.py` | Semantic rules beyond JSON Schema | New dialect, or new uniqueness/reference/SQL rule |

Additive changes (new optional field, new enum value) rarely touch examples; breaking changes
(renames, new required fields) touch every example and may need a validator update.

## Output

- All three core artifacts updated consistently (or an explicit note on any that intentionally differ).
- `validate.py` updated if a new semantic rule applies.
- `validate-examples.sh` passing on every example.
- A short summary of what changed in each file.

## Common mistakes

- Editing `spec.md` but not `osi-schema.json` (or vice versa) — they drift and converters break.
- Adding an enum value to `osi-schema.json`'s `Dialect` but forgetting `validate.py`'s `DIALECT_MAP`.
- Making a field required without adding it to every `examples/*.yaml`.
- Bumping the `version` here — that's a separate repo-wide chore, not part of a spec edit.
- Finishing without re-running the validator.
