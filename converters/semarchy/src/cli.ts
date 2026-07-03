#!/usr/bin/env node
/**
 * osi-semarchy CLI.
 *
 *   osi-semarchy osi-to-semarchy -i model.yaml   -o semarchy-dir/
 *   osi-semarchy semarchy-to-osi -i semarchy-dir/ -o model.yaml
 *
 * The Semarchy side is a directory of `_type`-discriminated YAML objects; the
 * OSI side is a single YAML document.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { osiDocumentToSemarchy } from "./osi-to-semarchy.js";
import { semarchyToOsi } from "./semarchy-to-osi.js";
import { readSemarchyDir, writeSemarchyDir } from "./io.js";
import { validateOsi, validateSemarchy, type ValidationOutcome } from "./validation.js";
import type { OSIDocument } from "./osi-types.js";

function emitWarnings(warnings: string[]): void {
  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
}

function reportValidation(label: string, outcome: ValidationOutcome): void {
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
  .description("Convert an OSI model (YAML file) to a Semarchy model (directory of YAML)")
  .requiredOption("-i, --input <file>", "input OSI YAML file")
  .requiredOption("-o, --output <dir>", "output Semarchy directory")
  .action((opts: { input: string; output: string }) => {
    const doc = parseYaml(readFileSync(opts.input, "utf8")) as OSIDocument;
    const { model, warnings } = osiDocumentToSemarchy(doc);
    emitWarnings(warnings);
    reportValidation("semarchy output", validateSemarchy(model));
    writeSemarchyDir(opts.output, model);
  });

program
  .command("semarchy-to-osi")
  .description("Convert a Semarchy model (directory of YAML) to an OSI model (YAML file)")
  .requiredOption("-i, --input <dir>", "input Semarchy directory")
  .requiredOption("-o, --output <file>", "output OSI YAML file")
  .action((opts: { input: string; output: string }) => {
    const warnings: string[] = [];
    const model = readSemarchyDir(opts.input, warnings);
    const { document, warnings: mapWarnings } = semarchyToOsi(model, warnings);
    emitWarnings(mapWarnings);
    reportValidation("osi output", validateOsi(document));
    writeFileSync(opts.output, stringifyYaml(document));
  });

program.parse();
