def normalize_findings(data):
    findings = []

    for result in data["results"]:
        findings.append({
            "title": result["check_id"].split(".")[-1],
            "severity": result["extra"]["severity"],
            "file": result["path"],
            "line": result["start"]["line"],
            "description": result["extra"]["message"],
            "rule": result["check_id"]
        })

    return findings