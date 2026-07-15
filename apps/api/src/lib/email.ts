import { Resend } from 'resend';

let _resend: Resend | null = null;

/**
 * Lazy singleton — mirrors lib/stripe.ts's getStripe(). Deliberately does
 * NOT read/validate RESEND_API_KEY at import time, so the server boots
 * cleanly with it unset (e.g. local dev, or before email sending is wired
 * up for a given deployment). Only throws when an email is actually sent.
 */
function getResend(): Resend {
    if (_resend) return _resend;
    const key = process.env['RESEND_API_KEY'];
    if (!key) throw new Error('RESEND_API_KEY not configured — set it before sending invitation emails');
    _resend = new Resend(key);
    return _resend;
}

/**
 * Escapes HTML-significant characters. org.name is admin-controlled
 * (max 200 chars, see auth.schema.ts) but not sanitized on input, so it must
 * be escaped here before interpolation into email HTML.
 */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Sends the team-invitation email. Failures propagate to the caller
 * (invitation.service.ts) rather than being swallowed here — the caller
 * decides whether a failed send should roll back the created Invitation row.
 */
export async function sendInvitationEmail(to: string, inviteUrl: string, orgName: string): Promise<void> {
    const from = process.env['EMAIL_FROM'];
    if (!from) throw new Error('EMAIL_FROM not configured — set it before sending invitation emails');

    const safeOrgName = escapeHtml(orgName);

    await getResend().emails.send({
        from,
        to,
        subject: `You've been invited to join ${orgName} on Bin Tracker`,
        html: `<p>You've been invited to join <strong>${safeOrgName}</strong> on Bin Tracker.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    });
}
