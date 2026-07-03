/**
 * Directory-tree I/O for Semarchy models.
 *
 * A Semarchy model is a nested directory of `.seml` (YAML) files; each file is
 * one `_type`-discriminated object (entities under `entities/<Name>/`,
 * references under `references/`, etc.). We walk the tree recursively, group the
 * mapped object types into a `SemarchyModel`, take the model name from the
 * `Model` object, and warn about (drop) everything else.
 *
 * On write we emit one file per object, named `<_name>.<_type>.seml`.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import type {
  SemarchyEntity,
  SemarchyModel,
  SemarchyModelObject,
  SemarchyObject,
  SemarchyReference,
  SemarchyUniqueKey,
} from "./semarchy-types.js";

/** Semarchy object types this converter maps; all others are dropped on read. */
const MAPPED_TYPES = new Set(["Entity", "Reference", "UniqueKey"]);
/** Types consumed as model metadata (not mapped, but not warned about). */
const META_TYPES = new Set(["Model"]);
const MODEL_FILE_RE = /\.(seml|ya?ml)$/i;

/** Recursively collect model files under a directory. */
function walk(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`not a directory: ${dir}`);
  }
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (MODEL_FILE_RE.test(entry.name)) out.push(full);
  }
  return out.sort();
}

/** Read a directory tree of Semarchy objects into a grouped model. */
export function readSemarchyDir(
  dir: string,
  warnings: string[] = [],
): SemarchyModel {
  const entities: SemarchyEntity[] = [];
  const references: SemarchyReference[] = [];
  const uniqueKeys: SemarchyUniqueKey[] = [];
  let modelObj: SemarchyModelObject | undefined;

  for (const file of walk(dir)) {
    for (const doc of parseAllDocuments(readFileSync(file, "utf8"))) {
      const obj = doc.toJSON() as SemarchyObject | null;
      if (!obj || typeof obj !== "object" || typeof obj._type !== "string") {
        continue;
      }
      const type = obj._type;
      if (type === "Entity") entities.push(obj as SemarchyEntity);
      else if (type === "Reference") references.push(obj as SemarchyReference);
      else if (type === "UniqueKey") uniqueKeys.push(obj as SemarchyUniqueKey);
      else if (type === "Model") modelObj = obj as SemarchyModelObject;
      else if (!META_TYPES.has(type)) {
        warnings.push(
          `[drop] unsupported Semarchy type "${type}"` +
            (obj._name ? ` (${obj._name})` : "") +
            ` in ${file}`,
        );
      }
    }
  }

  if (!modelObj) {
    warnings.push(`[model] no Model object found in ${dir}; using "model"`);
  }

  return {
    name: modelObj?._name ?? modelObj?.label ?? "model",
    pkg: modelObj?._package ?? modelObj?._name ?? "model",
    entities,
    references,
    uniqueKeys,
  };
}

/** Last dot-separated segment of a Semarchy fully-qualified name. */
function localName(fqn: string): string {
  const parts = fqn.split(".");
  return parts[parts.length - 1] ?? fqn;
}

function writeObject(dir: string, obj: SemarchyObject): void {
  mkdirSync(dir, { recursive: true });
  const file = `${obj._name ?? "unnamed"}.${obj._type}.seml`;
  writeFileSync(join(dir, file), stringifyYaml(obj));
}

/**
 * Write a Semarchy model to a directory tree mirroring the native layout:
 *   <pkg>.Model.seml
 *   entities/<Name>/<Name>.Entity.seml
 *   entities/<Name>/unique_keys/<Name>.UniqueKey.seml
 *   references/<Name>.Reference.seml
 */
export function writeSemarchyDir(dir: string, model: SemarchyModel): void {
  mkdirSync(dir, { recursive: true });
  if (model.modelObject) writeObject(dir, model.modelObject);

  for (const entity of model.entities) {
    writeObject(join(dir, "entities", entity._name), entity);
  }
  for (const uk of model.uniqueKeys) {
    const entity = localName(uk.entity);
    writeObject(join(dir, "entities", entity, "unique_keys"), uk);
  }
  for (const ref of model.references) {
    writeObject(join(dir, "references"), ref);
  }
}
