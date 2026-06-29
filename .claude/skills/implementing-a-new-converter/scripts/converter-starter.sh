#!/usr/bin/env bash
# converter-starter.sh — recommend the existing converter to copy for a new one,
# with its build/test/run commands. Read-only; prints guidance, creates nothing.
#
# Usage: converter-starter.sh [style]
#   style ∈ python-cli | python-lib | python-script | java
# With no style, lists the available styles and their reference converters.

set -euo pipefail

style="${1:-}"

list_styles() {
  cat <<'EOF'
Choose a style (pass it as the argument):

  python-cli     -> copy converters/dbt        (uv + hatchling, CLI entry w/ subcommands, syrupy tests)
  python-lib     -> copy converters/gooddata   (uv + hatchling, library API, ruff, conftest fixtures)
  python-script  -> copy converters/snowflake  (plain project, requirements.txt, argparse -i/-o script)
  java           -> copy converters/salesforce (offline file conversion) or converters/polaris (live service)

Then: copy that directory to converters/<vendor>/, rename packages/artifacts,
and adapt. Add the vendor to the Supported Vendors table in converters/index.md.
EOF
}

case "$style" in
  python-cli)
    cat <<'EOF'
style:        python-cli
copy:         converters/dbt
shape:        uv + hatchling; [project.scripts] entry exposing subcommands
              (e.g. msi-to-osi / osi-to-msi); depends on osi-python; syrupy snapshot tests
build/test:   cd converters/<vendor> && uv sync && uv run pytest
run:          <cli> <import|export-subcmd> -i <in> -o <out>
key files:    pyproject.toml, src/<pkg>/cli.py, src/<pkg>/<import>.py, src/<pkg>/<export>.py, tests/
EOF
    ;;
  python-lib)
    cat <<'EOF'
style:        python-lib
copy:         converters/gooddata
shape:        uv + hatchling; importable library API (no CLI); ruff (line-length 120);
              conftest.py fixtures backed by tests/fixtures/*
build/test:   cd converters/<vendor> && uv sync --group dev && uv run pytest && uv run ruff check .
run:          imported as a library (e.g. vendor_to_osi(...) / osi_to_vendor(...))
key files:    pyproject.toml, src/<pkg>/<vendor>_to_osi.py, src/<pkg>/osi_to_<vendor>.py, src/<pkg>/models.py, tests/conftest.py
EOF
    ;;
  python-script)
    cat <<'EOF'
style:        python-script
copy:         converters/snowflake
shape:        no pyproject; requirements.txt; single argparse script under src/ (-i/-o)
build/test:   cd converters/<vendor> && pip3 install -r requirements.txt && python3 -m pytest tests/
run:          python3 src/<script>.py -i <in> -o <out>
key files:    requirements.txt, src/<script>.py, tests/test_<script>.py
EOF
    ;;
  java)
    cat <<'EOF'
style:        java
copy:         converters/salesforce (offline file conversion)  |  converters/polaris (live service via REST)
shape:        Maven; self-contained executable jar with subcommands; JUnit 5
build/test:   cd converters/<vendor> && mvn clean package && mvn test   (single: mvn test -Dtest=ClassName)
run:          java -jar target/<artifact>-<version>.jar <import|export-subcmd> <args>
key files:    pom.xml, src/main/java/org/osi/..., src/test/java/org/osi/...Test.java
              (salesforce also bundles schemas under src/main/resources/schemas/)
EOF
    ;;
  "")
    list_styles
    ;;
  *)
    echo "error: unknown style '$style'" >&2
    echo >&2
    list_styles >&2
    exit 1
    ;;
esac
