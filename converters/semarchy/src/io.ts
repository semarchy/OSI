/**
 * Directory-of-YAML I/O for Semarchy models.
 *
 * A Semarchy model is delivered as a directory of YAML files; each YAML
 * document is one `_type`-discriminated object. On read we group the mapped
 * object types into a `SemarchyModel` and warn about (drop) everything else.
 * On write we emit one YAML file per object, named `<_type>.<_name>.yaml`.
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
  SemarchyObject,
  SemarchyReference,
  SemarchyUniqueKey,
} from "./semarchy-types.js";

/** Semarchy object types this converter maps; all others are dropped on read. */
const MAPPED_TYPES = new Set(["Entity", "Reference", "UniqueKey"]);

function listYamlFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`not a directory: ${dir}`);
  }
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/i.test(f))
    .sort()
    .map((f) => join(dir, f));
}

/** Read a directory of Semarchy YAML objects into a grouped model. */
export function readSemarchyDir(
  dir: string,
  warnings: string[] = [],
): SemarchyModel {
  const entities: SemarchyEntity[] = [];
  const references: SemarchyReference[] = [];
  const uniqueKeys: SemarchyUniqueKey[] = [];
  const packages = new Set<string>();

  for (const file of listYamlFiles(dir)) {
    const docs = parseAllDocuments(readFileSync(file, "utf8"));
    for (const doc of docs) {
      const obj = doc.toJSON() as SemarchyObject | null;
      if (!obj || typeof obj !== "object" || !("_type" in obj)) continue;
      const type = obj._type;
      if (typeof obj._package === "string") packages.add(obj._package);
      if (!MAPPED_TYPES.has(type)) {
        warnings.push(
          `[drop] unsupported Semarchy type "${type}"` +
            (obj._name ? ` (${obj._name})` : "") +
            ` in ${file}`,
        );
        continue;
      }
      if (type === "Entity") entities.push(obj as SemarchyEntity);
      else if (type === "Reference") references.push(obj as SemarchyReference);
      else if (type === "UniqueKey") uniqueKeys.push(obj as SemarchyUniqueKey);
    }
  }

  if (packages.size > 1) {
    warnings.push(
      `[model] multiple packages found (${[...packages].join(", ")}); ` +
        `using "${[...packages][0]}" as the model name`,
    );
  }

  return {
    pkg: [...packages][0] ?? "model",
    entities,
    references,
    uniqueKeys,
  };
}

/** Write a Semarchy model to a directory, one YAML file per object. */
export function writeSemarchyDir(dir: string, model: SemarchyModel): void {
  mkdirSync(dir, { recursive: true });
  const objects: SemarchyObject[] = [
    ...model.entities,
    ...model.uniqueKeys,
    ...model.references,
  ];
  for (const obj of objects) {
    const name = `${obj._type}.${obj._name ?? "unnamed"}.yaml`;
    writeFileSync(join(dir, name), stringifyYaml(obj));
  }
}
