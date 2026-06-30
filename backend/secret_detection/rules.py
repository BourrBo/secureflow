"""
rules.py
Regex-based secret detection rules, inspired by gitleaks' default ruleset.
Each rule matches a known secret "shape" (vendor key formats, tokens, etc.)

NOTE: Pattern-based, deterministic checks only — no external API calls.
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Pattern


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class SecretRule:
    id: str
    description: str
    regex: Pattern
    severity: Severity


SECRET_RULES: List[SecretRule] = [
    SecretRule(
        id="aws-access-key",
        description="AWS Access Key ID",
        regex=re.compile(r"\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b"),
        severity=Severity.CRITICAL,
    ),
    SecretRule(
        id="aws-secret-key",
        description="AWS Secret Access Key",
        regex=re.compile(r"\b[A-Za-z0-9/+=]{40}\b"),
        severity=Severity.CRITICAL,
    ),
    SecretRule(
        id="github-token",
        description="GitHub Personal Access / App Token",
        regex=re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,255}\b"),
        severity=Severity.CRITICAL,
    ),
    SecretRule(
        id="gitlab-token",
        description="GitLab Personal Access Token",
        regex=re.compile(r"\bglpat-[A-Za-z0-9\-_]{20}\b"),
        severity=Severity.CRITICAL,
    ),
    SecretRule(
        id="slack-token",
        description="Slack Token",
        regex=re.compile(r"\bxox[baprs]-[0-9a-zA-Z]{10,48}\b"),
        severity=Severity.HIGH,
    ),
    SecretRule(
        id="slack-webhook",
        description="Slack Webhook URL",
        regex=re.compile(
            r"https://hooks\.slack\.com/services/T[A-Za-z0-9_]{8,12}/B[A-Za-z0-9_]{8,12}/[A-Za-z0-9_]{24}"
        ),
        severity=Severity.HIGH,
    ),
    SecretRule(
        id="google-api-key",
        description="Google API Key",
        regex=re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b"),
        severity=Severity.HIGH,
    ),
    SecretRule(
        id="stripe-key",
        description="Stripe API Key",
        regex=re.compile(r"\b(sk|rk|pk)_(live|test)_[0-9a-zA-Z]{24,99}\b"),
        severity=Severity.CRITICAL,
    ),
    SecretRule(
        id="openai-key",
        description="OpenAI API Key",
        regex=re.compile(r"\bsk-[A-Za-z0-9]{20,48}\b"),
        severity=Severity.HIGH,
    ),
    SecretRule(
        id="private-key-block",
        description="PEM-format Private Key",
        regex=re.compile(r"-----BEGIN ((RSA|EC|DSA|OPENSSH|PGP) )?PRIVATE KEY( BLOCK)?-----"),
        severity=Severity.CRITICAL,
    ),
    SecretRule(
        id="jwt",
        description="JSON Web Token",
        regex=re.compile(r"\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
        severity=Severity.MEDIUM,
    ),
    SecretRule(
        id="generic-api-key-assignment",
        description="Generic API key / secret / token assigned in code or config",
        regex=re.compile(
            r"""\b(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'`]?[A-Za-z0-9_\-/+]{12,}["'`]?""",
            re.IGNORECASE,
        ),
        severity=Severity.MEDIUM,
    ),
    SecretRule(
        id="db-connection-string",
        description="Database connection string with embedded credentials",
        regex=re.compile(
            r"""\b(postgres|postgresql|mysql|mongodb(\+srv)?)://[^:\s]+:[^@\s]+@[^\s'"]+""",
            re.IGNORECASE,
        ),
        severity=Severity.HIGH,
    ),
    SecretRule(
        id="npm-token",
        description="npm Access Token",
        regex=re.compile(r"\bnpm_[A-Za-z0-9]{36}\b"),
        severity=Severity.HIGH,
    ),
]

# Lines containing this marker are skipped — equivalent to gitleaks:allow.
# e.g.  demo_key = "AKIAFAKEFAKEFAKEFAKE"  # secureflow:allow
ALLOWLIST_MARKER = "secureflow:allow"

# Paths/extensions we never want to scan.
DEFAULT_IGNORE_PATTERNS: List[Pattern] = [
    re.compile(r"node_modules/"),
    re.compile(r"\.git/"),
    re.compile(r"\.next/"),
    re.compile(r"__pycache__/"),
    re.compile(r"\.venv/"),
    re.compile(r"venv/"),
    re.compile(r"dist/"),
    re.compile(r"build/"),
    re.compile(r"package-lock\.json$"),
    re.compile(r"yarn\.lock$"),
    re.compile(r"pnpm-lock\.yaml$"),
    re.compile(r"poetry\.lock$"),
    re.compile(r"\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|mp4|mp3|pdf|zip|tar|gz)$", re.IGNORECASE),
]
