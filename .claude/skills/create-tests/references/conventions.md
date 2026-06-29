# OSI test conventions (per sub-project)

Full reference for the `create-tests` skill. Each section gives the framework, exact paths, the
fixtures/helpers to reuse, the run + single-test commands, and a representative skeleton so a
generated test matches house style. All inline OSI models use the canonical envelope:

```yaml
version: "0.2.0.dev0"
semantic_model:
  - name: ...
    datasets: [...]
```

---

## `python` (osi-python) — pytest

Shared Pydantic types library. **No `tests/` directory exists yet** — create one. Dev dep:
`pytest>=8.0` (in `pyproject.toml`). Built with hatchling, `packages = ["src/osi"]`.

- Test dir: `python/tests/` (create it)
- Naming: `test_*.py`
- Run: `cd python && uv sync && uv run pytest`
- Single test: `cd python && uv run pytest tests/test_models.py::test_name`

Import the package under test directly (`from osi.models import ...`).

---

## `converters/dbt` (osi-dbt) — pytest + syrupy snapshots

- Test dir: `converters/dbt/tests/`
- Naming: `test_*.py` (e.g. `test_msi_to_osi.py`, `test_osi_to_msi.py`)
- Fixtures/helpers: **`tests/helpers.py`** builder functions — reuse these, don't rebuild:
  `_manifest()`, `_simple_metric()`, `_dimension()`, `_entity()`, `_measure()`, `_filter()`,
  `_osi_expr()`, `_osi_field()`, `_osi_dataset()`, `_osi_metric()`, `_osi_relationship()`,
  `_osi_doc()`.
- Run: `cd converters/dbt && uv sync && uv run pytest`
- Single test: `uv run pytest tests/test_msi_to_osi.py::TestBasicConversion::test_name`

**Snapshots:** assertions compare against `snapshot` (a `SnapshotAssertion`). On the first run for a
new snapshot test, generate snapshots with `uv run pytest --snapshot-update` (writes `.ambr`
files), then run plain `uv run pytest` to confirm. Note `.ambr` files are not currently checked in.

Skeleton:

```python
import json
from typing import List, Optional

import pytest
from syrupy.assertion import SnapshotAssertion

from osi_dbt.converter_issues import ConverterIssueType
from osi_dbt.msi_to_osi import MSIToOSIConverter
from tests.helpers import _manifest, _simple_metric, _dimension, _entity, _measure, _filter


class TestBasicConversion:
    def test_empty_manifest_produces_empty_datasets(self) -> None:
        result = MSIToOSIConverter().convert(_manifest(), osi_model_name="test").output
        assert result.version == "0.2.0.dev0"
        assert len(result.semantic_model) == 1

    def test_roundtrip_preserves_structure(self, snapshot: SnapshotAssertion) -> None:
        osi_doc = ...  # build via helpers
        assert osi_doc.to_osi_yaml() == snapshot
```

---

## `converters/gooddata` (gooddata-osi) — pytest + pytest-cov

- Test dir: `converters/gooddata/tests/`
- Naming: `test_*.py` (`test_gooddata_to_osi.py`, `test_osi_to_gooddata.py`, `test_models.py`,
  `test_roundtrip.py`)
- Fixtures/helpers: **`tests/conftest.py`** fixtures backed by `tests/fixtures/`
  (`gooddata_tpcds.json`, `osi_tpcds.yaml`). Inject fixtures as test params — reuse, don't reload:
  `gooddata_tpcds_dict`, `gooddata_tpcds_model`, etc.
- Config: `pythonpath = ["src"]`, `testpaths = ["tests"]`; Python 3.12+; linted with ruff (line 120).
- Run: `cd converters/gooddata && uv sync --group dev && uv run pytest && uv run ruff check .`
- Single test: `uv run pytest tests/test_gooddata_to_osi.py::test_basic_conversion`

Skeleton:

```python
from gooddata_osi.gooddata_to_osi import gooddata_to_osi
from gooddata_osi.models import GdDeclarativeModel


def test_basic_conversion(gooddata_tpcds_model: GdDeclarativeModel):
    result = gooddata_to_osi(gooddata_tpcds_model, model_name="tpcds_test")
    assert result["version"] == "0.2.0.dev0"
    sm = result["semantic_model"][0]
    assert sm["name"] == "tpcds_test"
```

Plain dict/list navigation with `assert`; no snapshots. New `conftest.py` fixture pattern:

```python
import json
import pytest
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"

@pytest.fixture()
def gooddata_tpcds_dict() -> dict:
    with open(FIXTURES_DIR / "gooddata_tpcds.json") as f:
        return json.load(f)
```

---

## `converters/snowflake` — pytest (plain project)

One-way OSI → Snowflake Cortex Analyst. No `pyproject.toml`; deps in `requirements.txt`.

- Test dir: `converters/snowflake/tests/`
- Naming: `test_*.py` (`test_osi_to_snowflake_yaml_converter.py`)
- Fixtures/helpers: **inline, module-level** — reuse `_wrap_osi(model_dict)` (wraps a model in the
  OSI envelope) and `_minimal_model(**overrides)` (returns a minimal valid OSI model dict). No
  conftest.
- Run: `cd converters/snowflake && pip3 install -r requirements.txt && python3 -m pytest tests/`
- Single test: `python3 -m pytest tests/test_osi_to_snowflake_yaml_converter.py::TestParseSource::test_three_part_name`

Skeleton (note the `sys.path` insert to import from `src/`):

```python
import sys
import warnings
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from osi_to_snowflake_yaml_converter import (
    OsiConversionError, convert_osi_to_snowflake, _classify_field, _parse_source,
)


def _wrap_osi(model_dict):
    return yaml.dump({"version": "0.2.0.dev0", "semantic_model": [model_dict]},
                     default_flow_style=False)


class TestParseSource:
    def test_three_part_name(self):
        assert _parse_source("db.schema.table") == {"database": "DB", "schema": "SCHEMA", "table": "TABLE"}
```

---

## `converters/polaris` — JUnit 5 / Maven (Java 11+)

Bidirectional OSI ↔ Apache Polaris. **Talks to a live Polaris server** for import/export — prefer
unit-testing the offline pieces (`OsiModelParser`, `OsiYamlGenerator`).

- Test dir: `converters/polaris/src/test/java/org/osi/converter/polaris/`
- Naming: `*Test.java` (`OsiPolarisConverterTest.java`)
- Fixtures: inline `private static final String` YAML constants (no test resources dir).
- Deps: `junit-jupiter` 5.10.2, `snakeyaml` 2.2, `jackson-databind` 2.17.0.
- Run: `cd converters/polaris && mvn test`
- Single class: `mvn test -Dtest=OsiPolarisConverterTest`

Skeleton:

```java
package org.osi.converter.polaris;

import org.junit.jupiter.api.Test;
import org.osi.converter.polaris.model.OsiModel;
import org.osi.converter.polaris.model.OsiModel.*;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class OsiPolarisConverterTest {
    private static final String MINIMAL_MODEL =
            "version: \"0.2.0.dev0\"\n"
          + "semantic_model:\n"
          + "  - name: test_model\n"
          + "    datasets:\n"
          + "      - name: orders\n"
          + "        source: catalog.ns.orders\n"
          + "        fields:\n"
          + "          - name: order_id\n"
          + "            expression:\n"
          + "              dialects:\n"
          + "                - dialect: ANSI_SQL\n"
          + "                  expression: order_id\n";

    @Test
    void testParseMinimalModel() {
        OsiModel model = new OsiModelParser().parse(
                new ByteArrayInputStream(MINIMAL_MODEL.getBytes(StandardCharsets.UTF_8)));
        assertEquals("0.2.0.dev0", model.getVersion());
        assertEquals("test_model", model.getSemanticModels().get(0).getName());
    }
}
```

---

## `converters/salesforce` — JUnit 5 / Maven (Java 17+)

Lossless bidirectional OSI ↔ Salesforce Semantic Model.

- Test dir: `converters/salesforce/src/test/java/org/osi/`
- Naming: `*Test.java` (`OsiToSalesforceConverterTest.java`, `SalesforceToOsiConverterTest.java`)
- Fixtures: **`src/test/resources/examples/`** — `osiToSalesforce.yaml`, `salesforceToOsi.json`,
  loaded with `Files.readString(Paths.get(...))`.
- Deps: `junit-jupiter` 5.11.4, `jackson-databind`/`jackson-dataformat-yaml` 2.18.6,
  `json-schema-validator` 1.5.5.
- Run: `cd converters/salesforce && mvn test`
- Single class: `mvn test -Dtest=OsiToSalesforceConverterTest`

**Schema guard:** tests skip via `assumeTrue()` unless both schemas exist under
`src/main/resources/schemas/`. Mirror this so the suite degrades gracefully:

```java
package org.osi;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.osi.converter.Converter;
import org.osi.converter.ConverterFactory;
import org.osi.converter.ConversionDirection;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class OsiToSalesforceConverterTest {
    private static boolean osiSchemaExists;
    private Converter converter;
    private ObjectMapper jsonMapper;
    private String osiYaml;

    @BeforeAll
    static void checkSchemaAvailability() {
        osiSchemaExists = OsiToSalesforceConverterTest.class
                .getResourceAsStream(SchemaValidator.OSI_SCHEMA_PATH) != null;
    }

    @BeforeEach
    void setUp() throws Exception {
        assumeTrue(osiSchemaExists, "OSI schema file is required but not found");
        converter = ConverterFactory.getConverter(ConversionDirection.OSI_TO_SALESFORCE);
        jsonMapper = new ObjectMapper();
        osiYaml = Files.readString(Paths.get("src/test/resources/examples/osiToSalesforce.yaml"));
    }

    @Test
    void testCompleteConversion() throws Exception {
        List<String> results = converter.convert(osiYaml);
        assertEquals(1, results.size());
        Map<String, Object> sfModel = jsonMapper.readValue(results.get(0), new TypeReference<>() {});
        assertEquals("Customer_Orders_Model", sfModel.get("apiName"));
    }
}
```
