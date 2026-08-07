"""
utils/business_email.py

SecureFlow only allows sign-in from business/company email addresses —
free personal email providers are rejected. This is a denylist approach
(block known personal providers, allow everything else) rather than an
allowlist, since we don't know every company's domain in advance and a
custom domain is itself decent evidence of a business account.

This is NOT foolproof — someone could register yet another free provider
we haven't listed, or a domain we've blocked could actually be used by a
business (e.g. some companies do use a Zoho/GMX address). Treat this as a
practical filter, not a strong identity guarantee.
"""

PERSONAL_EMAIL_DOMAINS = {
    # Google
    "gmail.com", "googlemail.com",
    # Microsoft
    "outlook.com", "hotmail.com", "live.com", "msn.com",
    # Yahoo
    "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "ymail.com", "rocketmail.com",
    # Apple
    "icloud.com", "me.com", "mac.com",
    # Other common free/personal providers
    "aol.com", "protonmail.com", "proton.me", "pm.me",
    "gmx.com", "gmx.net", "mail.com", "yandex.com", "yandex.ru",
    "zoho.com", "zohomail.com",
    "rediffmail.com", "inbox.com", "fastmail.com",
    "tutanota.com", "tuta.io",
    # Disposable/throwaway providers
    "mailinator.com", "10minutemail.com", "guerrillamail.com", "temp-mail.org",
}


def is_business_email(email: str | None) -> bool:
    """True if `email`'s domain is NOT a known personal/free provider.
    Returns False (rejected) for missing/malformed email too."""
    if not email or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].strip().lower()
    return domain not in PERSONAL_EMAIL_DOMAINS
