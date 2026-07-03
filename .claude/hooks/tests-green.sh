#!/usr/bin/env bash
#
# "Not done until tests are green" — Claude Code Stop hook.
#
# Runs the test suite of every subproject that has UNCOMMITTED changes (per
# `git status`). If any suite fails, it blocks the stop (exit 2 + a JSON
# `decision: block` reason) so Claude keeps working until the tests pass.
# If nothing relevant changed, or all selected suites pass, it exits 0.
#
# Scope is intentionally limited to changed subprojects so that heavy/unattended
# suites don't run needlessly. Assumptions when a subproject IS touched:
#   - Python subprojects use `uv` (uv run auto-syncs from the lockfile).
#   - converters/snowflake expects `pytest` importable in `python3`.
#   - converters/polaris / salesforce expect their build prerequisites in place
#     (correct Java version; polaris a reachable server; salesforce the schemas
#     fetched into src/main/resources/schemas). These only run when touched.
#
set -uo pipefail

# Drain stdin (Stop hook JSON payload); we don't need it.
cat >/dev/null 2>&1 || true

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0

# Per-suite wall-clock cap so a hung or networked run can't wedge the session.
TIMEOUT=${TESTS_GREEN_TIMEOUT:-600}

changed=$(git status --porcelain 2>/dev/null | awk '{ $1=""; sub(/^ /, ""); print }')
[ -z "$changed" ] && exit 0

# Build the ordered set of suites to run, keyed by path prefix. Each entry is
# "label|command"; we dedupe by label.
declare -A suites=()
add_suite() { suites["$1"]="$2"; }

while IFS= read -r path; do
  [ -z "$path" ] && continue
  # Handle rename "old -> new" entries: consider the destination.
  path=${path##* -> }
  case "$path" in
    python/*)                add_suite "python"     "cd python && uv run pytest" ;;
    converters/dbt/*)        add_suite "dbt"        "cd converters/dbt && uv run pytest" ;;
    converters/gooddata/*)   add_suite "gooddata"   "cd converters/gooddata && uv run pytest && uv run ruff check ." ;;
    converters/snowflake/*)  add_suite "snowflake"  "cd converters/snowflake && python3 -m pytest tests/" ;;
    converters/polaris/*)    add_suite "polaris"    "cd converters/polaris && mvn -q test" ;;
    converters/salesforce/*) add_suite "salesforce" "cd converters/salesforce && mvn -q test" ;;
    core-spec/*|examples/*|ontology/*)
                             add_suite "validation" "python validation/validate.py examples/tpcds_semantic_model.yaml" ;;
  esac
done <<< "$changed"

[ ${#suites[@]} -eq 0 ] && exit 0

# pytest returns exit code 5 when it collects no tests; that is not a failure.
is_pytest_suite() {
  case "$1" in python|dbt|gooddata|snowflake) return 0 ;; *) return 1 ;; esac
}

failures=""
for label in "${!suites[@]}"; do
  cmd=${suites[$label]}
  out=$(cd "$ROOT" && timeout "$TIMEOUT" bash -c "$cmd" 2>&1)
  status=$?
  if [ "$status" -eq 5 ] && is_pytest_suite "$label"; then
    status=0
  fi
  if [ "$status" -ne 0 ]; then
    tail_out=$(printf '%s\n' "$out" | tail -n 40)
    failures+="### ${label} (exit ${status}) — reproduce with: ${cmd}"$'\n'
    failures+="$tail_out"$'\n\n'
  fi
done

if [ -n "$failures" ]; then
  reason="Tests are not green — not done yet. Fix the following before finishing:"$'\n\n'"$failures"
  # Emit a JSON block decision. Use python for safe JSON string escaping.
  python3 - "$reason" <<'PY'
import json, sys
print(json.dumps({"decision": "block", "reason": sys.argv[1]}))
PY
  exit 2
fi

exit 0
