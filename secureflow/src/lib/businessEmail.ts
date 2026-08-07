/**
 * SecureFlow is a workplace product: accounts must be tied to a company domain.
 * Anything not on this personal-provider denylist is treated as a business domain.
 */
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "zohomail.com",
  "rediffmail.com",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
  "tuta.io",
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "temp-mail.org",
]);

export const BUSINESS_EMAIL_FIELD_ERROR = "Please use your business email address";

export const BUSINESS_EMAIL_BLOCKED_MESSAGE =
  "SecureFlow requires a business email address — personal email accounts (Gmail, Yahoo, Outlook, etc.) aren't supported. Please sign in with your work account.";

export function isBusinessEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return !PERSONAL_EMAIL_DOMAINS.has(domain);
}
