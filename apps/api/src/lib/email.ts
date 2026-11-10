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

/**
 * Sends the employee's one-time bank-details link. The URL carries the ONLY
 * copy of the raw token (the DB holds just its hash), so this email is the
 * credential — hence the single-use wording and the short expiry.
 *
 * Deliberately contains no bank fields and asks for nothing by reply: the
 * employee types their details into the linked page, never into an email.
 */
export async function sendBankDetailsRequestEmail(to: string, url: string, orgName: string): Promise<void> {
    const from = process.env['EMAIL_FROM'];
    if (!from) throw new Error('EMAIL_FROM not configured — set it before sending bank details emails');

    const safeOrgName = escapeHtml(orgName);

    await getResend().emails.send({
        from,
        to,
        subject: `${orgName} needs your direct deposit details`,
        html: [
            `<p><strong>${safeOrgName}</strong> is setting up direct deposit so your pay can be sent straight to your bank account.</p>`,
            `<p><a href="${url}">Add your bank details</a></p>`,
            `<p>You'll need your account number, account name, bank name, routing number (5 digits) and institution number (3 digits) — all of these are on a cheque, or under "direct deposit info" in most online banking apps.</p>`,
            `<p>This link works once and expires in 7 days. Never send your bank details by email reply.</p>`,
        ].join(''),
    });
}

/**
 * Sends an employee their one-time NFC phone-registration link. Like the bank-details email, the URL is the
 * ONLY copy of the raw token (the database holds just its hash), so it says the link works once, is personal,
 * and expires. Failures propagate: the caller decides what the manager sees, and must never log the URL.
 */
export async function sendRegistrationLinkEmail(
    to: string,
    url: string,
    orgName: string,
    employeeName: string,
    expiresAt: Date,
): Promise<void> {
    const from = process.env['EMAIL_FROM'];
    if (!from) throw new Error('EMAIL_FROM not configured — set it before sending registration link emails');

    const safeOrgName = escapeHtml(orgName);
    const safeName = escapeHtml(employeeName);
    const safeUrl = escapeHtml(url);
    const expires = expiresAt.toUTCString().replace(' GMT', ' UTC');

    // The Resend client RETURNS a provider rejection ({ error }) instead of throwing, so it must be checked here, or a
    // message the provider refused would be reported to the manager as sent. Only the error's code and status go into
    // the thrown message: the provider's own text can echo the request, and the request contains the one-time link.
    const { error } = await getResend().emails.send({
        from,
        to,
        subject: `Set up your phone to clock in at ${orgName}`,
        html: [
            `<p>Hi ${safeName},</p>`,
            `<p><strong>${safeOrgName}</strong> now uses NFC tags to clock in and out. Set up your phone once, then clocking in is a single tap.</p>`,
            `<ol>`,
            `<li>On the phone you will use, open this link in <strong>Chrome or Safari</strong> (not inside WhatsApp or another app): <a href="${safeUrl}">Set up my phone</a></li>`,
            `<li>When the page says your name, hold the back of your phone against the NFC tag at the door within 10 minutes.</li>`,
            `<li>The phone says "Phone registered!". From then on, just tap the tag to check in and tap again to check out.</li>`,
            `</ol>`,
            `<p>This link works once, is for you only (please do not forward it), and expires on ${expires}. If it does not work, ask your manager for a new one.</p>`,
        ].join(''),
    });
    if (error) throw new Error(`Email provider rejected the registration link email (${error.name}${error.statusCode ? `, HTTP ${error.statusCode}` : ''})`);
}

/**
 * Security notice to the PREVIOUS payroll manager address when it changes.
 * managerEmail is effectively an approval credential (its inbox authorizes
 * payouts), so the old holder must find out if it is silently redirected.
 * Best-effort — callers must not fail the settings save if this throws.
 */
export async function sendManagerEmailChangedNotice(
    to: string,
    orgName: string,
    newEmail: string | null,
): Promise<void> {
    const from = process.env['EMAIL_FROM'];
    if (!from) throw new Error('EMAIL_FROM not configured — set it before sending manager change notices');

    const safeOrgName = escapeHtml(orgName);
    const safeNew = newEmail ? escapeHtml(newEmail) : null;

    await getResend().emails.send({
        from,
        to,
        subject: `${orgName}: payroll approval email changed`,
        html: [
            `<p>The payroll approval email for <strong>${safeOrgName}</strong> was just changed.</p>`,
            safeNew
                ? `<p>Approval requests now go to <strong>${safeNew}</strong> instead of this address.</p>`
                : `<p>The approval address was removed — approval emails are paused until a new one is set.</p>`,
            `<p>If you expected this, no action is needed. If you did NOT expect it, contact your organization admin immediately — payroll approvals may be redirected.</p>`,
        ].join(''),
    });
}
