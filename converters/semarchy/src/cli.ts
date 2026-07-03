#!/usr/bin/env node
/**
 * osi-semarchy CLI.
 *
 *   osi-semarchy osi-to-semarchy -i model.yaml -o model.semarchy.json
 *   osi-semarchy semarchy-to-osi -i model.semarchy.json -o model.yaml
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { osiDocumentToSemarchy } from "./osi-to-semarchy.js";
import { semarchyToOsi } from "./semarchy-to-osi.js";
import { validateOsi, validateSemarchy } from "./validation.js";
import type { OSIDocument } from "./osi-types.js";
import type { SemarchyModel } from "./semarchy-types.js";

function emitWarnings(warnings: string[]): void {
  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
}

function reportValidation(label: string, outcome: ReturnType<typeof validateOsi>): void {
  if (outcome.skipped) {
    process.stderr.write(`warning: ${label} ${outcome.errors[0]}\n`);
  } else if (!outcome.valid) {
    process.stderr.write(`error: ${label} validation failed:\n`);
    for (const e of outcome.errors) process.stderr.write(`  - ${e}\n`);
    process.exitCode = 1;
  }
}

const program = new Command();
program
  .name("osi-semarchy")
  .description("Bidirectional OSI <> Semarchy semantic model converter");

program
  .command("osi-to-semarchy")
  .description("Convert an OSI model (YAML) to a Semarchy model (JSON)")
  .requiredOption("-i, --input <file>", "input OSI YAML file")
  .requiredOption("-o, --output <file>", "output Semarchy JSON file")
  .action((opts: { input: string; output: string }) => {
    const doc = parseYaml(readFileSync(opts.input, "utf8")) as OSIDocument;
    const { model, warnings } = osiDocumentToSemarchy(doc);
    emitWarnings(warnings);
    reportValidation("semarchy output", validateSemarchy(model));
    writeFileSync(opts.output, JSON.stringify(model, null, 2) + "\n");
  });

program
  .command("semarchy-to-osi")
  .description("Convert a Semarchy model (JSON) to an OSI model (YAML)")
  .requiredOption("-i, --input <file>", "input Semarchy JSON file")
  .requiredOption("-o, --output <file>", "output OSI YAML file")
  .action((opts: { input: string; output: string }) => {
    const model = JSON.parse(readFileSync(opts.input, "utf8")) as SemarchyModel;
    const { document, warnings } = semarchyToOsi(model);
    emitWarnings(warnings);
    reportValidation("osi output", validateOsi(document));
    writeFileSync(opts.output, stringifyYaml(document));
  });

program.parse();
