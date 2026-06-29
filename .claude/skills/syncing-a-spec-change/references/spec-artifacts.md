# OSI spec artifacts & per-change-type checklists

Reference for the `syncing-a-spec-change` skill. The spec is one model expressed four ways; this
file maps where each concept lives and what to touch for each kind of change.

## The artifacts

| File | What it is | Notes |
| :--- | :--------- | :---- |
| `core-spec/spec.md` | Human-readable spec: prose, field tables (Field/Type/Required/Description), enum tables, inline YAML examples. | The contract people read. |
| `core-spec/spec.yaml` | "Schema-by-example": every field declared with a placeholder type and an explanatory `#` comment; includes the `dialects:` enum list and `version:`. | Mirrors the schema in a readable, annotated form. |
| `core-spec/osi-schema.json` | JSON Schema, Draft 2020-12. Top level requires `version` (a `const`) and `semantic_model`; `additionalProperties: false`. Reusable types under `$defs` (e.g. `Dialect`, `Vendor`, `AIContext`, `SemanticModel`, datasets, fields, metrics, relationships). | The **enforced** definition — what `validate.py`, converters, and tools check against. |
| `examples/tpcds_semantic_model.yaml` | Complete semantic-model fixture; validates against `osi-schema.json`. | The main conformance example. |
| `examples/flights.yaml` | **Ontology** doc (`ontology` / `ontology_mappings`, no `semantic_model`); validates against `ontology/ontology.json`, *not* the core schema. | The `examples/` dir mixes both document kinds. |
| `validation/validate.py` | Validates a model against `osi-schema.json` (defaults to it) **plus** semantic checks the schema can't express: unique names, valid relationship references, SQL syntax via sqlglot. | `DIALECT_MAP` maps OSI dialects → sqlglot dialects. Functions: `validate_schema`, `validate_unique_names`, `validate_references`, `validate_sql`. |

Because `additionalProperties: false` is set, **any new field must be declared in
`osi-schema.json`** or every model using it fails validation.

## Where a concept lives (example: a Dialect)

- `spec.md` → the **Dialects** table (one row per dialect).
- `spec.yaml` → the `dialects:` list (one `- "VALUE"  # comment` per dialect).
- `osi-schema.json` → `$defs/Dialect.enum`.
- `validation/validate.py` → `DIALECT_MAP` (OSI value → sqlglot dialect, or `None` for ANSI).

The same three-place (spec.md table ↔ spec.yaml annotated entry ↔ osi-schema.json `$defs`/property)
pattern holds for fields, metrics, relationships, and other enums.

## Per-change-type checklists

### Add a new enum value (e.g. a dialect or vendor)
1. `spec.md` — add a row to the relevant enum table.
2. `spec.yaml` — add the list entry with a comment.
3. `osi-schema.json` — add the value to the corresponding `$defs/<Enum>.enum`.
4. `validate.py` — if it's a dialect, add it to `DIALECT_MAP` (sqlglot name or `None`).
5. Optionally exercise it in an example.

### Add a new field
1. `spec.md` — add a row to the owning object's field table (set Required correctly) and update any
   inline example.
2. `spec.yaml` — add the annotated field under the right object.
3. `osi-schema.json` — add the property to the object's `$defs` entry; if **required**, add it to
   that object's `required` array. (Declaring it is mandatory — `additionalProperties: false`.)
4. Examples — if required, add it to **every** `examples/*.yaml`; if optional, add to at least one.
5. `validate.py` — only if the field needs a cross-field/reference/SQL rule.

### Rename a field or enum value (breaking)
1. Update the name in `spec.md`, `spec.yaml`, and `osi-schema.json` (`$defs`, `properties`,
   `required`, any `$ref`).
2. Update **every** occurrence in `examples/*.yaml`.
3. `validate.py` — update any check or `DIALECT_MAP` key referencing the old name.
4. Note: converters under `converters/` also reference field names — flag them as follow-up
   (out of scope for the spec sync itself).

### Change a constraint (required ⇄ optional, type, cardinality)
1. `spec.md` — update the Required column / type / description.
2. `spec.yaml` — update the placeholder/comment.
3. `osi-schema.json` — update `type`, the object's `required` array, or array/`items` constraints.
4. Examples — adjust so they still validate (a new requirement must be satisfied everywhere).

## Verification

Always finish by running every example through the validator:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/validate-examples.sh"
```

It validates each `examples/*.yaml` against the **matching** schema — semantic-model docs against
`core-spec/osi-schema.json`, ontology docs against `ontology/ontology.json` (chosen by content).
Semantic checks (unique names, references, SQL) run for `semantic_model` payloads. SQL checks need
`sqlglot` installed (otherwise skipped with a warning).
