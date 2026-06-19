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

        findings.append({
            "title": result["check_id"].split(".")[-1],
            "severity": result["extra"]["severity"],
            "file": result["path"],
            "line": result["start"]["line"],
            "description": result["extra"]["message"],
            "rule": result["check_id"],
            "cwe": cwe,
            "owasp": owasp,
        })

    return findings