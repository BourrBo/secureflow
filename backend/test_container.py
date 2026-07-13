import json

from scanners.container_runner import run_container_scan
from parsers.container_parser import normalize_container_findings


raw_results = run_container_scan("nginx:latest")

findings = normalize_container_findings(raw_results)

print(json.dumps(findings[:10], indent=4))