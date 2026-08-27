import hashlib

# Per-scanner identity fields, folded into the SHA-256 fingerprint. Mirrors
# the *idea* of DefectDojo's HASHCODE_FIELDS_PER_SCANNER: a SAST rule-hit and
# a CVE need different identity fields, so one global field list would either
# over- or under-merge.
HASHCODE_FIELDS_PER_SCANNER: dict[str, list[str]] = {
    # Semgrep (SAST): same rule flagged in the same file is the same issue
    # even if the exact line shifts a few lines up/down between scans.
    "semgrep": ["rule", "cwe", "file"],
    # Trivy (SCA): same package + same CVE, wherever the manifest lives.
    "trivy": ["cve", "title", "ecosystem"],
    # Checkov (IaC): same check id against the same resource/file.
    "checkov": ["rule", "file"],
    # Secrets: same rule/pattern in the same file. Line is deliberately
    # excluded -- an unrelated one-line edit earlier in the file would
    # otherwise shift every secret below it and make them look "new".
    "secrets": ["rule", "file"],
    # ZAP (DAST): same alert (pluginId) against the same URL.
    "dast": ["rule", "file"],
    # Container (Phase 6, Trivy `image` mode): same identity shape as SCA.
    "container": ["cve", "title", "ecosystem"],
}

_DEFAULT_FIELDS = ["title", "file", "severity"]


def compute_unique_id_from_tool(finding: dict) -> str | None:
    """Strong scanner-native id, only for scanners that expose one we trust
    to be stable across scans. Everything else relies on the fingerprint.
    CVE-bearing scanners (Trivy/Container) qualify; SAST/IaC/Secrets/DAST
    rule ids are too generic on their own (many files can trip the same
    rule) so they're identity-by-fingerprint only.
    """
    scanner = (finding.get("scanner") or "").lower()
    cve = finding.get("cve")
    if scanner in ("trivy", "container") and cve and cve not in ("N/A", ""):
        ecosystem = (finding.get("ecosystem") or "").strip().lower()
        return f"{scanner}:{cve.strip().lower()}:{ecosystem}"
    return None


def compute_fingerprint(finding: dict, project_id: int) -> str:
    """Stable SHA-256 fingerprint, always scoped to project_id (the same CVE
    or rule hit in two different projects must never be merged into one
    finding -- this plays the same role as DefectDojo's
    HASH_CODE_FIELDS_ALWAYS = ["service"]).

    Missing fields hash as empty string rather than being skipped, so a
    finding genuinely missing a CWE doesn't silently collide with one that
    has it.
    """
    scanner = (finding.get("scanner") or "").lower()
    fields = HASHCODE_FIELDS_PER_SCANNER.get(scanner, _DEFAULT_FIELDS)

    parts = [str(project_id)]
    for field in fields:
        value = finding.get(field)
        parts.append(str(value).strip().lower() if value not in (None, "") else "")

    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_identity(finding: dict, project_id: int) -> tuple[str, str | None]:
    """Returns (fingerprint, unique_id_from_tool) for a finding dict, the
    two values callers persist and match new findings against."""
    return compute_fingerprint(finding, project_id), compute_unique_id_from_tool(finding)