import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { osiDocumentToSemarchy, osiToSemarchy } from "../src/osi-to-semarchy.js";
import { semarchyToOsi } from "../src/semarchy-to-osi.js";
import { readSemarchyDir, writeSemarchyDir } from "../src/io.js";
import { validateOsi, validateSemarchy } from "../src/validation.js";
import type { OSIDocument } from "../src/osi-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPCDS = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "examples",
  "tpcds_semantic_model.yaml",
);
const FIXTURE_DIR = resolve(__dirname, "fixtures", "semarchy-model");

function loadTpcds(): OSIDocument {
  return parseYaml(readFileSync(TPCDS, "utf8")) as OSIDocument;
}

describe("export OSI -> Semarchy", () => {
  it("maps the TPC-DS baseline and produces schema-valid Semarchy objects", () => {
    const doc = loadTpcds();
    const { model, warnings } = osiDocumentToSemarchy(doc);

    expect(model.entities).toHaveLength(doc.semantic_model[0]!.datasets.length);

    const outcome = validateSemarchy(model);
    expect(outcome.skipped).toBe(false);
    expect(outcome.errors).toEqual([]);
    expect(outcome.valid).toBe(true);

    // TPC-DS has metrics; Semarchy has no measure concept, so they are dropped.
    expect(warnings.some((w) => w.startsWith("[drop] metric"))).toBe(true);
  });
});

describe("import Semarchy -> OSI", () => {
  it("maps the fixture directory to a schema-valid OSI document", () => {
    const warnings: string[] = [];
    const model = readSemarchyDir(FIXTURE_DIR, warnings);
    const { document } = semarchyToOsi(model, warnings);

    expect(document.semantic_model[0]!.name).toBe("retail");
    expect(document.semantic_model[0]!.datasets.map((d) => d.name).sort()).toEqual([
      "Customer",
      "SalesOrder",
    ]);
    // Non-semantic Form object is dropped with a warning.
    expect(warnings.some((w) => w.includes('unsupported Semarchy type "Form"'))).toBe(true);

    const outcome = validateOsi(document);
    expect(outcome.skipped).toBe(false);
    expect(outcome.errors).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("maps a temporal attribute to a time dimension", () => {
    const model = readSemarchyDir(FIXTURE_DIR);
    const { document } = semarchyToOsi(model);
    const customer = document.semantic_model[0]!.datasets.find(
      (d) => d.name === "Customer",
    )!;
    const createdAt = customer.fields!.find((f) => f.name === "createdAt")!;
    expect(createdAt.dimension?.is_time).toBe(true);
  });
});

describe("SemQL enricher <-> computed field", () => {
  it("import adds a SEMARCHY dialect to the enriched field, keeping ANSI_SQL", () => {
    const warnings: string[] = [];
    const model = readSemarchyDir(FIXTURE_DIR, warnings);
    const { document } = semarchyToOsi(model, warnings);

    const fullName = document.semantic_model[0]!.datasets
      .find((d) => d.name === "Customer")!
      .fields!.find((f) => f.name === "fullName")!;
    const byDialect = Object.fromEntries(
      fullName.expression.dialects.map((d) => [d.dialect, d.expression]),
    );
    expect(byDialect.ANSI_SQL).toBe("FULL_NAME"); // physical column preserved
    expect(byDialect.SEMARCHY).toBe("UPPER(fullName)"); // SemQL computation

    // The enricher-level condition has no OSI equivalent and is dropped.
    expect(warnings.some((w) => w.includes("SemQL condition"))).toBe(true);
  });

  it("export regenerates a SemQLEnricher from the computed field", () => {
    const model = readSemarchyDir(FIXTURE_DIR);
    const { document } = semarchyToOsi(model);
    const { model: exported } = osiToSemarchy(document.semantic_model[0]!);

    expect(exported.enrichers).toHaveLength(1);
    const enricher = exported.enrichers[0]!;
    expect(enricher.entity).toBe("retail.entities.Customer.Customer");
    expect(enricher.semQlEnricherExpressions).toEqual([
      { attributeName: "fullName", expression: "UPPER(fullName)" },
    ]);
    // The enriched attribute keeps its physical column (not the SemQL).
    const customer = exported.entities.find((e) => e._name === "Customer")!;
    expect(customer.attributes.find((a) => a._name === "fullName")!.physicalName).toBe(
      "FULL_NAME",
    );
    expect(validateSemarchy(exported).valid).toBe(true);
  });
});

describe("roundtrip Semarchy -> OSI -> Semarchy", () => {
  it("preserves the core ER structure (entities, references, unique keys)", () => {
    const original = readSemarchyDir(FIXTURE_DIR);
    const { document } = semarchyToOsi(original);
    const { model: roundtripped } = osiToSemarchy(document.semantic_model[0]!);

    expect(roundtripped.entities.map((e) => e._name).sort()).toEqual(
      original.entities.map((e) => e._name).sort(),
    );
    expect(roundtripped.references.map((r) => r._name)).toEqual(
      original.references.map((r) => r._name),
    );
    const localName = (fqn: string) => fqn.split(".").pop();
    expect(roundtripped.uniqueKeys.map((u) => localName(u.entity))).toEqual(
      original.uniqueKeys.map((u) => localName(u.entity)),
    );

    // Attribute sets survive per entity.
    for (const entity of original.entities) {
      const rt = roundtripped.entities.find((e) => e._name === entity._name)!;
      expect(rt.attributes.map((a) => a._name).sort()).toEqual(
        entity.attributes.map((a) => a._name).sort(),
      );
    }

    // The roundtripped Semarchy model still validates.
    expect(validateSemarchy(roundtripped).valid).toBe(true);
  });
});

describe("export writes a re-importable Semarchy directory tree", () => {
  const tmp = mkdtempSync(join(tmpdir(), "osi-semarchy-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("emits a Model object, nested entities/, and references/ that re-import", () => {
    const original = readSemarchyDir(FIXTURE_DIR);
    const { document } = semarchyToOsi(original);
    const { model } = osiToSemarchy(document.semantic_model[0]!);

    writeSemarchyDir(tmp, model);
    const reread = readSemarchyDir(tmp);

    // The Model object round-trips (its _name is the OSI model name).
    expect(reread.name).toBe(document.semantic_model[0]!.name);
    expect(reread.entities.map((e) => e._name).sort()).toEqual(
      original.entities.map((e) => e._name).sort(),
    );
    expect(reread.references.map((r) => r._name)).toEqual(
      original.references.map((r) => r._name),
    );
    // FQN references survive: the reference resolves back to a relationship.
    const { document: reDoc } = semarchyToOsi(reread);
    expect(reDoc.semantic_model[0]!.relationships?.map((r) => `${r.from}->${r.to}`)).toEqual(
      document.semantic_model[0]!.relationships?.map((r) => `${r.from}->${r.to}`),
    );
    expect(validateOsi(reDoc).valid).toBe(true);
  });
});
