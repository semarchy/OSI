import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { osiDocumentToSemarchy, osiToSemarchy } from "../src/osi-to-semarchy.js";
import { semarchyToOsi } from "../src/semarchy-to-osi.js";
import { readSemarchyDir } from "../src/io.js";
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
    expect(roundtripped.uniqueKeys.map((u) => u.entity)).toEqual(
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
