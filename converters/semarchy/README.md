# osi-semarchy

Bidirectional converter between [OSI](../../core-spec/spec.md) and the **Semarchy**
xDM semantic model.

- **Export** — OSI → Semarchy (`osi-to-semarchy`)
- **Import** — Semarchy → OSI (`semarchy-to-osi`)

Unlike the other reference converters (Python / Java), this one is written in
**TypeScript** (Node ≥ 18, ESM). It is fully offline: it only reads and writes
files.

## Model shape

A Semarchy model is a **nested directory tree of `.seml` (YAML) files**, each
file one `_type`-discriminated object (entities under `entities/<Name>/`,
references under `references/`, …), plus a root `Model` object. Import walks the
tree recursively (accepting `.seml`, `.yaml`, `.yml`), takes the model name from
the `Model` object, and resolves the fully-qualified references Semarchy uses
(`Pkg.entities.Item.Item.UPC`) down to local names. The OSI side is a single
YAML document. Export writes the same native tree — a root `Model` object,
`entities/<Name>/<Name>.Entity.seml`, `entities/<Name>/unique_keys/…`, and
`references/<Name>.Reference.seml`, with fully-qualified references regenerated —
so the output re-imports cleanly (verified on the real ProductRetail model).

## Install & build

```bash
cd converters/semarchy
npm install
npm run build        # emits dist/ (library + CLI)
npm test             # vitest
npm run typecheck
```

Requires Node ≥ 18 (declared in `engines`).

## CLI

```bash
# OSI (YAML file) -> Semarchy (directory of .seml)
osi-semarchy osi-to-semarchy -i model.yaml -o semarchy-dir/

# Semarchy (directory tree of .seml) -> OSI (YAML file)
osi-semarchy semarchy-to-osi -i semarchy-model-src/ -o model.yaml
```

## Library

```ts
import {
  osiDocumentToSemarchy,
  semarchyToOsi,
  readSemarchyDir,
  writeSemarchyDir,
} from "osi-semarchy";
```

## Mapping

| Semarchy | OSI | Notes |
|----------|-----|-------|
| `Entity` | `dataset` | `source` = `<_package>.<physicalTableName>` |
| `EntityAttribute` | `field` | field `name` = attribute `_name`; `ANSI_SQL` expression = `physicalName`; `Date`/`Timestamp` → `dimension.is_time` |
| `Entity.primaryKey` | `dataset.primary_key` | |
| `UniqueKey` | `dataset.unique_keys` | matched by owning entity; composite order preserved |
| `Reference` | `relationship` | `fromEntity` = many side → `from`; `toEntity` = one side → `to`; FK column from the foreign attribute / role name |
| `SemQLEnricher` | computed `field` | each `{attributeName, expression}` adds a `SEMARCHY` dialect entry (the SemQL) to the field, keeping its `ANSI_SQL` column reference; enricher `condition` is dropped |

## Design notes

- **Computed fields / SemQL**: a `SemQLEnricher` expression is carried on the
  OSI field in the `SEMARCHY` dialect (SemQL is *not* SQL and is not translated),
  alongside the field's `ANSI_SQL` physical-column reference. On export, fields
  carrying a `SEMARCHY` expression are grouped back into one `SemQLEnricher` per
  entity, and the physical column always comes from the `ANSI_SQL` expression
  (never the SemQL). `SEMARCHY` was added to the core-spec `Dialect` enum for
  this purpose.
- **Validation**: OSI output is validated against `schemas/osi-schema.json`
  (draft 2020-12); each emitted Semarchy object is validated against its
  per-type schema in `schemas/` (draft-07). Best-effort — skipped with a warning
  if a schema file is absent.

## Limitations

This converter maps the **core ER model only**. By design (Semarchy is an MDM
platform, not an analytics semantic layer), the roundtrip is **lossy** — the
following are **dropped with a warning**, not preserved in `custom_extensions`:

- **Metrics** — OSI metrics have no Semarchy equivalent (no measure concept), so
  they are dropped on export.
- **SemQL constructs** — `SemQLEnricher` computed attributes *are* mapped (see
  Design notes), but the enricher-level `condition`, matchers, and survivorship
  rules are dropped.
- **Type definitions** — `ComplexType`, `UserDefinedType`, `LOVType` are dropped.
- **Views** — `DatabaseView`, `BusinessView` are dropped.
- **UI / process objects** — `Form`, `SearchForm`, `Stepper`, `Workflow`,
  `DisplayCard`, `CollectionView`, `ActionSet`, `ModelDiagram`, `Application`,
  and other MDM-operational objects are dropped.
- **Composite keys**: Semarchy entities use a single primary-key attribute and
  references model a single foreign key, so composite OSI primary keys / join
  keys are flattened to their first column on export (warned).
- On export, several required Semarchy fields OSI does not carry (physical
  names, labels, `entityType`, historization flags) are filled with defaults.
