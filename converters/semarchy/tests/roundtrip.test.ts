import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { osiDocumentToSemarchy } from "../src/osi-to-semarchy.js";
import { semarchyToOsi } from "../src/semarchy-to-osi.js";
import type { OSIDocument } from "../src/osi-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// TPC-DS baseline model, per the create-tests / converter guides.
const TPCDS = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "examples",
  "tpcds_semantic_model.yaml",
);

function loadTpcds(): OSIDocument {
  return parseYaml(readFileSync(TPCDS, "utf8")) as OSIDocument;
}

describe("OSI <> Semarchy", () => {
  it("exports the TPC-DS baseline without throwing", () => {
    const doc = loadTpcds();
    const { model } = osiDocumentToSemarchy(doc);
    expect(model.name).toBe(doc.semantic_model[0]!.name);
  });

  // TODO(schema): enable once the Semarchy JSON Schema and the per-construct
  // mapping are in place. A full Semarchy -> OSI -> Semarchy roundtrip must be
  // information-preserving (custom_extensions for anything without an OSI core
  // equivalent), per the converter guide.
  it.todo("roundtrips Semarchy -> OSI -> Semarchy without information loss");

  it("import of an empty Semarchy model yields a valid OSI envelope", () => {
    const { document } = semarchyToOsi({ name: "empty" });
    expect(document.version).toBe("0.2.0.dev0");
    expect(document.semantic_model).toHaveLength(1);
    expect(document.semantic_model[0]!.name).toBe("empty");
  });
});
