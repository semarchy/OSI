#!/usr/bin/env bash
# project-info.sh — map a path to its OSI sub-project's test conventions.
#
# Usage: project-info.sh <path-to-source-file-or-dir>
# Prints the sub-project, framework, test dir, naming rule, fixtures location,
# run command, and single-test command. Exits non-zero if the path is outside
# any known OSI sub-project.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <path-to-source-file-or-dir>" >&2
  exit 2
fi

# Repo root = four levels up from this script (.claude/skills/create-tests/scripts).
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../../.." && pwd)"

# Resolve input to an absolute path (the path need not exist).
input="$1"
abs="$(realpath -m -- "$input")"

# Make it relative to the repo root.
case "$abs" in
  "$repo_root"/*) rel="${abs#"$repo_root"/}" ;;
  "$repo_root")   rel="" ;;
  *)
    echo "error: '$input' is not inside the OSI repo ($repo_root)" >&2
    exit 1
    ;;
esac

emit() {
  cat <<EOF
sub-project:  $1
framework:    $2
test dir:     $3
naming:       $4
fixtures:     $5
run:          $6
single test:  $7
EOF
}

# Order matters: match the most specific (converters/*) prefixes first.
case "$rel" in
  converters/dbt|converters/dbt/*)
    emit "converters/dbt" "pytest + syrupy snapshots" \
      "converters/dbt/tests/ (test_*.py)" "test_*.py" \
      "tests/helpers.py builder functions (_manifest, _simple_metric, ...)" \
      "cd converters/dbt && uv sync && uv run pytest" \
      "uv run pytest tests/<file>::<Class>::<test>  (first run for new snapshots: uv run pytest --snapshot-update)"
    ;;
  converters/gooddata|converters/gooddata/*)
    emit "converters/gooddata" "pytest + pytest-cov" \
      "converters/gooddata/tests/ (test_*.py)" "test_*.py" \
      "tests/conftest.py fixtures + tests/fixtures/*.json|*.yaml" \
      "cd converters/gooddata && uv sync --group dev && uv run pytest && uv run ruff check ." \
      "uv run pytest tests/<file>::<test>"
    ;;
  converters/snowflake|converters/snowflake/*)
    emit "converters/snowflake" "pytest (plain project)" \
      "converters/snowflake/tests/ (test_*.py)" "test_*.py" \
      "inline module-level helpers (_wrap_osi, _minimal_model)" \
      "cd converters/snowflake && pip3 install -r requirements.txt && python3 -m pytest tests/" \
      "python3 -m pytest tests/<file>::<Class>::<test>"
    ;;
  converters/polaris|converters/polaris/*)
    emit "converters/polaris" "JUnit 5 / Maven (Java 11+)" \
      "converters/polaris/src/test/java/org/osi/converter/polaris/ (*Test.java)" "*Test.java" \
      "inline 'private static final String' YAML constants" \
      "cd converters/polaris && mvn test" \
      "cd converters/polaris && mvn test -Dtest=<ClassName>"
    ;;
  converters/salesforce|converters/salesforce/*)
    emit "converters/salesforce" "JUnit 5 / Maven (Java 17+)" \
      "converters/salesforce/src/test/java/org/osi/ (*Test.java)" "*Test.java" \
      "src/test/resources/examples/*.yaml|*.json (loaded via Files.readString)" \
      "cd converters/salesforce && mvn test" \
      "cd converters/salesforce && mvn test -Dtest=<ClassName>"
    ;;
  python|python/*)
    emit "python (osi-python)" "pytest" \
      "python/tests/ (create if absent; test_*.py)" "test_*.py" \
      "none yet — add fixtures/helpers as needed" \
      "cd python && uv sync && uv run pytest" \
      "uv run pytest tests/<file>::<test>"
    ;;
  *)
    echo "error: '$input' (repo-relative '$rel') is not in a known OSI sub-project." >&2
    echo "known: python, converters/{dbt,gooddata,snowflake,polaris,salesforce}" >&2
    exit 1
    ;;
esac
