/**
 * Client-side auth form validation. Format checks only — a well-formed but
 * fake domain (e.g. "gmilal.com") is syntactically valid and can't be
 * rejected by regex; the OTP verification step is what actually proves the
 * address is real.
 */
import mailcheck from 'mailcheck';

// Default threshold (2) misses real typos like "gmilal.com" (distance 2.5
// from "gmail.com"); 3 catches those without flagging real custom domains.
mailcheck.domainThreshold = 3;

// Requires: something before @, a domain, a dot, and a 2+ char TLD.
// Rejects "@mmail.com", "a@b", values with spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
    const trimmed = email.trim();
    if (!trimmed) return 'Email is required.';
    if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address (e.g. you@yourplant.com).';
    return null;
}

/** Suggests a corrected domain for likely typos (e.g. "gmilal.com" → "gmail.com"). Soft nudge only, never blocks submission. */
export function suggestEmailDomain(email: string): string | null {
    const result = mailcheck.run({ email: email.trim() });
    return result?.full ?? null;
}
