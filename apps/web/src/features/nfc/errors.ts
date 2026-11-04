import { TRPCClientError } from '@trpc/client';

interface ErrorData {
    appCode?: string;
    httpStatus?: number;
}

const dataOf = (e: unknown): ErrorData | undefined => (e instanceof TRPCClientError ? (e.data as ErrorData | undefined) : undefined);

/** The API's stable machine code (data.appCode), e.g. NO_SESSION or TOKEN_EXPIRED. */
export function appCodeOf(e: unknown): string | undefined {
    return dataOf(e)?.appCode;
}

/**
 * Worth retrying: the network dropped, a gateway returned a non-JSON page, or
 * the API said it was busy / timed out. Domain errors (not registered, link
 * used, …) are final and must not be retried.
 */
export function isTransientError(e: unknown): boolean {
    if (!(e instanceof TRPCClientError)) return true;
    const status = dataOf(e)?.httpStatus;
    if (status === undefined) return true;
    return [408, 429, 502, 503, 504].includes(status);
}

/** What a phone shows when a tap fails for a final reason. */
export const TAP_ERRORS: Record<string, { title: string; detail: string }> = {
    NO_SESSION: {
        title: 'Phone not registered',
        detail: 'This phone isn’t registered yet. Ask your manager for a registration link. If you just used one, open it again in Chrome or Safari, not inside WhatsApp.',
    },
    SESSION_NOT_FOUND: { title: 'Phone not registered', detail: 'This phone isn’t registered. Ask your manager for a registration link.' },
    SESSION_REVOKED: { title: 'Phone not allowed', detail: 'This phone has been removed. Ask your manager for a new registration link.' },
    EMPLOYEE_INACTIVE: { title: 'Account inactive', detail: 'Your account is inactive. Please contact your manager.' },
    CARD_INACTIVE: { title: 'Card not active', detail: 'This card isn’t active. Tell your manager.' },
    CARD_NOT_FOUND: { title: 'Card not recognised', detail: 'This card isn’t recognised for your account. Tell your manager.' },
    MODULE_DISABLED: { title: 'Attendance is off', detail: 'Attendance isn’t switched on for your organisation. Tell your manager.' },
    BAD_ORIGIN: { title: 'Open the link again', detail: 'Please tap the card again and open it in Chrome or Safari.' },
    SERVER_BUSY: { title: 'The system is busy', detail: 'Lots of people are tapping at once. Wait a moment and tap again.' },
    TOKEN_EXPIRED: { title: 'Link expired', detail: 'Your registration link has expired. Ask your manager for a new one.' },
    TOKEN_ALREADY_USED: { title: 'Link already used', detail: 'This registration link was already used. If setup didn’t finish, ask your manager for a new link.' },
    TOKEN_SUPERSEDED: { title: 'Link replaced', detail: 'A newer registration link was sent to you. Please use that one.' },
    TOKEN_NOT_FOUND: { title: 'Link not valid', detail: 'This registration link isn’t valid. Ask your manager for a new one.' },
};

/** Registration-page wording for the token problems (same codes, link-focused text). */
export const REGISTER_ERRORS: Record<string, string> = {
    TOKEN_EXPIRED: 'Your registration link has expired. Ask your manager for a new one.',
    TOKEN_ALREADY_USED: 'This registration link was already used. Ask your manager for a new one if setup didn’t finish.',
    TOKEN_SUPERSEDED: 'A newer registration link was sent to you. Please use that one.',
    TOKEN_NOT_FOUND: 'This registration link isn’t valid. Ask your manager for a new one.',
    EMPLOYEE_INACTIVE: 'Your account is inactive. Please contact your manager.',
};

const ADMIN_ERRORS: Record<string, string> = {
    DUPLICATE_CHIP_UID: 'A card with this chip UID already exists.',
    CARD_NOT_FOUND: 'That card no longer exists. Refresh the page.',
    EMPLOYEE_NOT_FOUND: 'That employee no longer exists. Refresh the page.',
    EMPLOYEE_INACTIVE: 'This employee is inactive. Reactivate them before setting up a phone.',
    DEVICE_SESSION_NOT_FOUND: 'That phone is already gone. Refresh the page.',
    WORK_SESSION_NOT_FOUND: 'That shift no longer exists. Refresh the page.',
    NOT_AUTO_CLOSED: 'Only forgotten check-outs (auto-closed shifts) can be approved here.',
    ALREADY_APPROVED: 'This shift was already approved.',
    INVALID_CHECK_OUT: 'The check-out time must be after check-in and not in the future.',
    OVERLAPS_NEXT_SESSION: 'That check-out overlaps the employee’s next shift. Choose an earlier time.',
};

/** A readable message for a failed manager action. */
export function describeAdminError(e: unknown): string {
    const code = appCodeOf(e);
    if (code && ADMIN_ERRORS[code]) return ADMIN_ERRORS[code];
    if (e instanceof TRPCClientError && dataOf(e)?.httpStatus === 400) return 'Some of the values entered are not valid. Check them and try again.';
    return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}
