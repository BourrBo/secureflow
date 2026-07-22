import json
import shutil
import pytest

from scanners.container_runner import run_container_scan
from parsers.container_parser import normalize_container_findings


if shutil.which("trivy") is None:
	pytest.skip("Trivy not available in PATH; skipping container scan script", allow_module_level=True)


raw_results = run_container_scan("nginx:latest")

findings = normalize_container_findings(raw_results)

print(json.dumps(findings[:10], indent=4))