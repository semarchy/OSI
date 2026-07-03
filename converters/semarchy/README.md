# osi-semarchy

Bidirectional converter between [OSI](../../core-spec/spec.md) and the **Semarchy**
semantic model.

- **Export** — OSI → Semarchy (`osi-to-semarchy`)
- **Import** — Semarchy → OSI (`semarchy-to-osi`)

Unlike the other reference converters (Python / Java), this one is written in
**TypeScript** (Node ≥ 18, ESM). It is offline: it only reads and writes files.

## Status

> ⚠️ **Scaffold — mapping incomplete.** The project structure, CLI, OSI types,
> the dialect-fallback chain, and schema-validation plumbing are in place and
> tested. The per-construct mapping is stubbed pending the **Semarchy semantic
> model JSON Schema** (see [`schemas/README.md`](schemas/README.md)). Every
> incomplete step is marked `TODO(schema)` in the source.

## Install & build

```bash
cd converters/semarchy
npm install
npm run build        # emits dist/ (library + CLI)
npm test             # vitest
npm run typecheck
```

## CLI

```bash
# OSI (YAML) -> Semarchy (JSON)
osi-semarchy osi-to-semarchy -i model.yaml -o model.semarchy.json

# Semarchy (JSON) -> OSI (YAML)
osi-semarchy semarchy-to-osi -i model.semarchy.json -o model.yaml
```

## Library

```ts
import { osiDocumentToSemarchy, semarchyToOsi } from "osi-semarchy";
```

## Design notes

- **Dialect selection** uses the OSI fallback chain: prefer the `SEMARCHY`
  dialect, fall back to `ANSI_SQL`, warn (or error) if neither is present. See
  `src/dialect.ts`. `SEMARCHY` was added to the core-spec `Dialect` enum for
  this converter.
- **Vendor name** for custom extensions is `SEMARCHY`. Extensions for *other*
  vendors are never discarded on import — they roundtrip untouched.
- **Roundtrip fidelity**: anything with no OSI core equivalent is preserved in
  `custom_extensions` (`vendor_name: "SEMARCHY"`); `ai_context` a target can't
  represent goes into a `COMMON` extension.
- **Validation**: OSI output is checked against `schemas/osi-schema.json` and
  Semarchy output against `schemas/semarchy-semantic-model-schema.json` when
  those files are present (best-effort; skipped with a warning otherwise).

## Limitations

- Mapping is not yet implemented (see **Status**); requires the Semarchy schema.
- Metrics using dialect-specific SQL absent from both `SEMARCHY` and `ANSI_SQL`
  are skipped with a warning rather than emitted.
