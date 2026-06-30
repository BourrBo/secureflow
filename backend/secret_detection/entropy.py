"""
entropy.py
Shannon entropy scoring — used to flag random-looking strings (likely secrets)
that don't match a known vendor pattern in rules.py.

High entropy = characters are evenly/unpredictably distributed (looks random).
English words/sentences have LOW entropy. A real API key/token has HIGH entropy.
"""

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import List

# Roughly matches "token-shaped" substrings: long runs of alnum/symbols, no spaces.
CANDIDATE_TOKEN_REGEX = re.compile(r"[A-Za-z0-9+/=_\-]{20,}")


def shannon_entropy(value: str) -> float:
    """Calculates Shannon entropy (bits per character) of a string."""
    if not value:
        return 0.0

    counts = Counter(value)
    length = len(value)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


@dataclass
class EntropyFinding:
    value: str
    entropy: float


def find_high_entropy_tokens(
    line: str,
    threshold: float = 3.5,
    min_length: int = 20,
) -> List[EntropyFinding]:
    """
    Scans a single line for high-entropy substrings.
    threshold: bits/char above which we treat it as "random enough" to flag.
      ~3.5 is a reasonable default for base64/hex-like secrets (gitleaks uses
      ~3.0-4.5 depending on charset; we use a slightly conservative default
      to limit noise).
    """
    findings: List[EntropyFinding] = []

    for match in CANDIDATE_TOKEN_REGEX.finditer(line):
        token = match.group(0)
        if len(token) < min_length:
            continue
        # Skip tokens that are mostly repeated characters (e.g. "aaaaaaaaaaaaaaaaaaaa")
        if len(set(token)) < 6:
            continue

        entropy = shannon_entropy(token)
        if entropy >= threshold:
            findings.append(EntropyFinding(value=token, entropy=round(entropy, 2)))

    return findings
