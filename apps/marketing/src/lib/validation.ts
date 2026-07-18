/**
 * Client-side auth form validation. Format checks only — a well-formed but
 * fake address can only be caught by Supabase's "Confirm email" flow.
 */

// Requires: something before @, a domain, a dot, and a 2+ char TLD.
// Rejects "@mmail.com", "a@b", values with spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN_LENGTH = 8;

export function validateEmail(email: string): string | null {
    const trimmed = email.trim();
    if (!trimmed) return 'Email is required.';
    if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address (e.g. you@yourplant.com).';
    return null;
}

export function validatePassword(password: string): string | null {
    if (!password) return 'Password is required.';
    if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    return null;
}
