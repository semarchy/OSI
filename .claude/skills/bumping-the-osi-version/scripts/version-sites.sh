#!/usr/bin/env bash
# version-sites.sh — list every site that hardcodes the OSI spec version.
#
# Read-only. Use before a version bump to find all occurrences (so none are
# missed), and after to confirm only intended changelog history remains.
#
# Usage: version-sites.sh [current_version]
#   current_version  defaults to the `version` const in core-spec/osi-schema.json.

set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../../.." && pwd)"
cd "$repo_root"

schema="core-spec/osi-schema.json"

# Detect the current version from the schema's version const, unless given.
current="${1:-}"
if [[ -z "$current" ]]; then
  if [[ -f "$schema" ]]; then
    current="$(grep -oE '"const"[[:space:]]*:[[:space:]]*"[^"]+"' "$schema" \
      | head -1 | sed -E 's/.*"const"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
  fi
fi
if [[ -z "$current" ]]; then
  echo "error: could not detect current version; pass it as an argument." >&2
  exit 2
fi

echo "Current OSI spec version: ${current}"
echo "Repo: ${repo_root}"
echo

echo "===== VERSION SITES (occurrences of '${current}') ====="
# Search text artifacts, skipping VCS/build/cache noise.
if ! grep -rn -F "$current" . \
      --include="*.toml" --include="*.md" --include="*.yaml" \
      --include="*.yml" --include="*.json" --include="*.txt" 2>/dev/null \
      | grep -vE '/(\.git|target|__pycache__|node_modules|\.venv)/' \
      | sort; then
  echo "  (none found — is the version already bumped?)"
fi

echo
echo "===== SEPARATE SCHEME — DO NOT bump with the spec version ====="
echo "Java converter artifact versions (version the jars, not the OSI spec):"
grep -rn -E "<version>[0-9].*-SNAPSHOT</version>" converters/*/pom.xml 2>/dev/null \
  || echo "  (none found)"

echo
echo "Reminder: bump value sites; APPEND changelog entries (spec.md, ontology.md)"
echo "instead of rewriting history; then re-validate examples/fixtures."
