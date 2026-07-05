from mappings.iso27001 import get_iso_control


def get_code_context(filepath: str, start_line: int, end_line: int, context: int = 2):
    """Read a few lines of real source around the finding, for display in the UI."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()

        start = max(0, start_line - 1 - context)
        end = min(len(lines), end_line + context)

        return [
            {
                "ln": i + 1,
                "code": lines[i].rstrip("\n"),
                "highlight": start_line <= i + 1 <= end_line,
            }
            for i in range(start, end)
        ]
    except Exception:
        return []


def normalize_findings(data):
    findings = []

    for result in data["results"]:
        metadata = result["extra"].get("metadata", {})

        # Semgrep gives CWE as a list like ["CWE-89: SQL Injection"], take the first
        cwe_list = metadata.get("cwe", [])
        cwe = cwe_list[0].split(":")[0] if cwe_list else "CWE-000"

        # OWASP comes as a list like ["A03:2021 - Injection"]
        owasp_list = metadata.get("owasp", [])
        owasp = owasp_list[0].split(" ")[0] if owasp_list else "A05:2021"

        start_line = result["start"]["line"]
        end_line = result["end"]["line"]

        iso = get_iso_control(cwe=cwe, scanner="semgrep")

        findings.append({
            "title": result["check_id"].split(".")[-1],
            "severity": result["extra"]["severity"],
            "file": result["path"],
            "line": start_line,
            "description": result["extra"]["message"],
            "rule": result["check_id"],
            "cwe": cwe,
            "owasp": owasp,
            "scanner": "semgrep",
            "iso27001_control": iso["id"],
            "iso27001_control_name": iso["name"],
            "iso27001_description": iso["description"],
            "code_context": get_code_context(result["path"], start_line, end_line),
        })

    return findings