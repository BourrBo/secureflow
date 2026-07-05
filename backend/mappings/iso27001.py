"""
mappings/iso27001.py

Maps scanner findings (SAST / SCA / IaC / Secret Detection) to the relevant
ISO/IEC 27001:2022 Annex A control, using the exact control text from
Table A.1 of the standard.

Usage:
    from mappings.iso27001 import get_iso_control

    control = get_iso_control(cwe="CWE-89", scanner="semgrep")
    # -> {
    #      "id": "8.28",
    #      "name": "Secure coding",
    #      "description": "Secure coding principles shall be applied to
    #                       software development."
    #    }
"""

# ── Full Annex A control text (Table A.1, ISO/IEC 27001:2022) ──
# Only the controls we actually reference below are included; add more
# here if new mappings are needed later.
ANNEX_A_CONTROLS = {
    "5.7": {
        "name": "Threat intelligence",
        "description": "Information relating to information security threats shall be collected and analysed to produce threat intelligence.",
    },
    "5.9": {
        "name": "Inventory of information and other associated assets",
        "description": "An inventory of information and other associated assets, including owners, shall be developed and maintained.",
    },
    "5.17": {
        "name": "Authentication information",
        "description": "Allocation and management of authentication information shall be controlled by a management process, including advising personnel on appropriate handling of authentication information.",
    },
    "5.21": {
        "name": "Managing information security in the ICT supply chain",
        "description": "Processes and procedures shall be defined and implemented to manage the information security risks associated with the ICT products and services supply chain.",
    },
    "8.3": {
        "name": "Information access restriction",
        "description": "Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control.",
    },
    "8.4": {
        "name": "Access to source code",
        "description": "Read and write access to source code, development tools and software libraries shall be appropriately managed.",
    },
    "8.5": {
        "name": "Secure authentication",
        "description": "Secure authentication technologies and procedures shall be implemented based on information access restrictions and the topic-specific policy on access control.",
    },
    "8.6": {
        "name": "Capacity management",
        "description": "The use of resources shall be monitored and adjusted in line with current and expected capacity requirements.",
    },
    "8.7": {
        "name": "Protection against malware",
        "description": "Protection against malware shall be implemented and supported by appropriate user awareness.",
    },
    "8.8": {
        "name": "Management of technical vulnerabilities",
        "description": "Information about technical vulnerabilities of information systems in use shall be obtained, the organization's exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken.",
    },
    "8.9": {
        "name": "Configuration management",
        "description": "Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.",
    },
    "8.10": {
        "name": "Information deletion",
        "description": "Information stored in information systems, devices or in any other storage media shall be deleted when no longer required.",
    },
    "8.11": {
        "name": "Data masking",
        "description": "Data masking shall be used in accordance with the organization's topic-specific policy on access control and other related topic-specific policies, and business requirements, taking applicable legislation into consideration.",
    },
    "8.12": {
        "name": "Data leakage prevention",
        "description": "Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.",
    },
    "8.20": {
        "name": "Networks security",
        "description": "Networks and network devices shall be secured, managed and controlled to protect information in systems and applications.",
    },
    "8.22": {
        "name": "Segregation of networks",
        "description": "Groups of information services, users and information systems shall be segregated in the organization's networks.",
    },
    "8.23": {
        "name": "Web filtering",
        "description": "Access to external websites shall be managed to reduce exposure to malicious content.",
    },
    "8.24": {
        "name": "Use of cryptography",
        "description": "Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.",
    },
    "8.25": {
        "name": "Secure development life cycle",
        "description": "Rules for the secure development of software and systems shall be established and applied.",
    },
    "8.26": {
        "name": "Application security requirements",
        "description": "Information security requirements shall be identified, specified and approved when developing or acquiring applications.",
    },
    "8.27": {
        "name": "Secure system architecture and engineering principles",
        "description": "Principles for engineering secure systems shall be established, documented, maintained and applied to any information system development activities.",
    },
    "8.28": {
        "name": "Secure coding",
        "description": "Secure coding principles shall be applied to software development.",
    },
    "8.29": {
        "name": "Security testing in development and acceptance",
        "description": "Security testing processes shall be defined and implemented in the development life cycle.",
    },
    "8.31": {
        "name": "Separation of development, test and production environments",
        "description": "Development, testing and production environments shall be separated and secured.",
    },
    "8.32": {
        "name": "Change management",
        "description": "Changes to information processing facilities and information systems shall be subject to change management procedures.",
    },
}

# ── CWE → Annex A control (most specific mapping; checked first) ──
_CWE_TO_CONTROL = {
    "CWE-89":  "8.28",   # SQL Injection -> Secure coding
    "CWE-79":  "8.28",   # XSS -> Secure coding
    "CWE-78":  "8.28",   # OS Command Injection -> Secure coding
    "CWE-611": "8.28",   # XXE -> Secure coding
    "CWE-502": "8.28",   # Insecure deserialization -> Secure coding
    "CWE-918": "8.20",   # SSRF -> Networks security
    "CWE-352": "8.26",   # CSRF -> Application security requirements
    "CWE-22":  "8.28",   # Path traversal -> Secure coding
    "CWE-287": "8.5",    # Improper authentication -> Secure authentication
    "CWE-327": "8.24",   # Broken/weak crypto -> Use of cryptography
    "CWE-798": "5.17",   # Hard-coded credentials -> Authentication information
    "CWE-732": "8.9",    # Incorrect permission / misconfiguration -> Configuration management
    "CWE-284": "8.3",    # Improper access control -> Information access restriction
    "CWE-400": "8.6",    # Uncontrolled resource consumption -> Capacity management
}

# ── Scanner-level default when no specific CWE mapping applies ──
_SCANNER_DEFAULT_CONTROL = {
    "semgrep": "8.28",   # SAST -> Secure coding
    "trivy":   "8.8",    # SCA  -> Management of technical vulnerabilities
    "checkov": "8.9",    # IaC  -> Configuration management
    "secrets": "5.17",   # Secret detection -> Authentication information
}

# ── Absolute fallback if scanner name itself is unrecognized ──
_DEFAULT_CONTROL = "8.28"


def get_iso_control(cwe: str = None, scanner: str = None) -> dict:
    """
    Resolve the best-matching ISO/IEC 27001:2022 Annex A control for a
    finding, given its CWE (most specific) and/or scanner type (fallback).

    Returns a dict: {"id": ..., "name": ..., "description": ...}
    """
    control_id = None

    if cwe and cwe in _CWE_TO_CONTROL:
        control_id = _CWE_TO_CONTROL[cwe]
    elif scanner and scanner in _SCANNER_DEFAULT_CONTROL:
        control_id = _SCANNER_DEFAULT_CONTROL[scanner]
    else:
        control_id = _DEFAULT_CONTROL

    control = ANNEX_A_CONTROLS[control_id]

    return {
        "id": control_id,
        "name": control["name"],
        "description": control["description"],
    }
