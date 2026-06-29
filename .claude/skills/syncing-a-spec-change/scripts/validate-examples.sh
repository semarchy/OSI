#!/usr/bin/env bash
# validate-examples.sh — validate every OSI example against the matching schema.
#
# Runs validation/validate.py over each examples/*.yaml, choosing the schema by
# content: semantic-model docs -> core-spec/osi-schema.json; ontology docs
# (ontology / ontology_mappings) -> ontology/ontology.json. Exits non-zero if
# any example fails. Use after a spec change to confirm artifacts + examples
# stayed in sync.

set -uo pipefail

# Repo root = four levels up from this script
# (.claude/skills/syncing-a-spec-change/scripts).
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../../.." && pwd)"

validator="${repo_root}/validation/validate.py"
schema="${repo_root}/core-spec/osi-schema.json"
ontology_schema="${repo_root}/ontology/ontology.json"
examples_dir="${repo_root}/examples"

py="$(command -v python3 || command -v python || true)"
if [[ -z "$py" ]]; then
  echo "error: python3 not found on PATH" >&2
  exit 2
fi
for f in "$validator" "$schema" "$examples_dir"; do
  if [[ ! -e "$f" ]]; then
    echo "error: missing $f" >&2
    exit 2
  fi
done

shopt -s nullglob
examples=("${examples_dir}"/*.yaml "${examples_dir}"/*.yml)
if [[ ${#examples[@]} -eq 0 ]]; then
  echo "error: no example models found under ${examples_dir}" >&2
  exit 2
fi

# Classify a model as "ontology" (top-level ontology/ontology_mappings, no
# semantic_model) or "core". Falls back to "core" on any parse trouble.
classify() {
  "$py" - "$1" <<'PY'
import sys, yaml
try:
    with open(sys.argv[1]) as f:
        d = yaml.safe_load(f) or {}
except Exception:
    print("core"); sys.exit(0)
if isinstance(d, dict) and d.get("semantic_model"):
    print("core")
elif isinstance(d, dict) and ("ontology" in d or "ontology_mappings" in d):
    print("ontology")
else:
    print("core")
PY
}

failures=0
for model in "${examples[@]}"; do
  kind="$(classify "$model")"
  if [[ "$kind" == "ontology" ]]; then
    used="$ontology_schema"
  else
    used="$schema"
  fi
  echo "── validating $(basename "$model") [${kind}: $(basename "$used")] ──"
  if [[ ! -e "$used" ]]; then
    echo "  error: schema $used not found" >&2
    failures=$((failures + 1))
    continue
  fi
  if "$py" "$validator" "$model" --schema "$used"; then
    :
  else
    failures=$((failures + 1))
  fi
done

echo
if [[ $failures -gt 0 ]]; then
  echo "RESULT: ${failures} example(s) FAILED validation." >&2
  exit 1
fi
echo "RESULT: all ${#examples[@]} example(s) passed."
