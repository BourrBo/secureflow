"""
scanner.py
Core secret-detection engine. Walks a directory tree, runs each text line
through (1) known-pattern regex rules and (2) entropy analysis, and returns
a structured findings list. Pure local computation — no external API calls.
"""

import os
import time
from dataclasses import dataclass, field
from typing import List, Optional

from .entropy import find_high_entropy_tokens
from .rules import (
    ALLOWLIST_MARKER,
    DEFAULT_IGNORE_PATTERNS,
    SECRET_RULES,
    SecretRule,
    Severity,
)


@dataclass
class SecretFinding:
    id: str                  # unique id for this finding (frontend uses this for ignore/resolve actions)
    rule_id: str              # e.g. "aws-access-key" or "entropy-generic"
    description: str
    severity: Severity
    file_path: str             # relative path from project root
    line: int                   # 1-indexed line number
    match: str                  # the matched secret, partially redacted
    detection_method: str        # "pattern" | "entropy"


@dataclass
class ScanResult:
    scanned_files: int
    findings: List[SecretFinding] = field(default_factory=list)
    duration_ms: int = 0


def _redact(value: str) -> str:
    """Redacts a matched secret for safe display, keeping first/last 4 chars."""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


def _should_ignore(rel_path: str, ignore_patterns: List) -> bool:
    return any(pattern.search(rel_path) for pattern in ignore_patterns)


def _is_likely_binary(chunk: bytes) -> bool:
    """Heuristic to skip binary files quickly without a full read."""
    return b"\x00" in chunk[:512]


def _walk_files(root_dir: str, ignore_patterns: List) -> List[str]:
    matched_files: List[str] = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # prune ignored directories in-place so os.walk doesn't descend into them
        pruned = []
        for d in dirnames:
            rel = os.path.relpath(os.path.join(dirpath, d), root_dir).replace(os.sep, "/") + "/"
            if not _should_ignore(rel, ignore_patterns):
                pruned.append(d)
        dirnames[:] = pruned

        for filename in filenames:
            full_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(full_path, root_dir).replace(os.sep, "/")
            if _should_ignore(rel_path, ignore_patterns):
                continue
            matched_files.append(full_path)
    return matched_files


def scan_directory_for_secrets(
    root_dir: str,
    ignore_patterns: Optional[List] = None,
    extra_rules: Optional[List[SecretRule]] = None,
    enable_entropy_scan: bool = True,
    entropy_threshold: float = 3.5,
) -> ScanResult:
    start = time.time()
    ignore_patterns = ignore_patterns or DEFAULT_IGNORE_PATTERNS
    rules = SECRET_RULES + (extra_rules or [])

    files = _walk_files(root_dir, ignore_patterns)
    findings: List[SecretFinding] = []
    scanned_files = 0
    finding_counter = 0

    for file_path in files:
        try:
            with open(file_path, "rb") as f:
                raw = f.read()
        except (OSError, PermissionError):
            continue

        if _is_likely_binary(raw):
            continue

        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            continue  # not valid utf-8 text, treat as binary/unsupported

        rel_path = os.path.relpath(file_path, root_dir).replace(os.sep, "/")
        lines = content.splitlines()
        scanned_files += 1

        # Track which lines already matched a pattern rule, so the entropy
        # scan doesn't double-report the same secret.
        line_has_pattern_match = [False] * len(lines)

        for idx, line in enumerate(lines):
            if ALLOWLIST_MARKER in line:
                continue

            for rule in rules:
                match = rule.regex.search(line)
                if match:
                    line_has_pattern_match[idx] = True
                    finding_counter += 1
                    findings.append(
                        SecretFinding(
                            id=f"f-{finding_counter}",
                            rule_id=rule.id,
                            description=rule.description,
                            severity=rule.severity,
                            file_path=rel_path,
                            line=idx + 1,
                            match=_redact(match.group(0)),
                            detection_method="pattern",
                        )
                    )

        if enable_entropy_scan:
            for idx, line in enumerate(lines):
                if line_has_pattern_match[idx]:
                    continue
                if ALLOWLIST_MARKER in line:
                    continue

                for hit in find_high_entropy_tokens(line, entropy_threshold):
                    finding_counter += 1
                    findings.append(
                        SecretFinding(
                            id=f"f-{finding_counter}",
                            rule_id="entropy-generic",
                            description=f"High-entropy string ({hit.entropy} bits/char) — possible undetected secret",
                            severity=Severity.LOW,
                            file_path=rel_path,
                            line=idx + 1,
                            match=_redact(hit.value),
                            detection_method="entropy",
                        )
                    )

    duration_ms = int((time.time() - start) * 1000)
    return ScanResult(scanned_files=scanned_files, findings=findings, duration_ms=duration_ms)
