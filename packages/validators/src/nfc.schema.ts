import { z } from 'zod';
import { text } from './text.js';

// ─── NFC attendance validators ────────────────────────────────
// Every free-text and id field goes through text() so a NUL byte is a clean
// 400, never a driver-level 500.

const id = text(z.string().trim().min(1).max(200));
const label = text(z.string().trim().min(1).max(200));

/** IN / OUT cards are strict; BOTH is one card that toggles. */
export const nfcDirectionSchema = z.enum(['IN', 'OUT', 'BOTH']);

export const createNfcCardSchema = z.object({
    label,
    direction: nfcDirectionSchema,
    chipUid: label,
});

/** Partial update: only the fields present change. */
export const updateNfcCardSchema = z.object({
    id,
    label: label.optional(),
    direction: nfcDirectionSchema.optional(),
    chipUid: label.optional(),
});

export const nfcCardRefSchema = z.object({ id });

export const setNfcCardActiveSchema = z.object({ id, active: z.boolean() });

/** The employee's phone taps a card (and, mid-registration, completes it). */
export const nfcTapSchema = z.object({ cardId: id });

/** Manager issues a registration link for one employee. */
export const sendRegistrationLinkSchema = z.object({ employeeId: id });

/**
 * Manager emails an already-issued registration link to the employee. Only the raw token is sent (never a URL):
 * the server rebuilds the link from its own APP_URL, so a caller cannot make it email any address of their choosing.
 */
export const emailRegistrationLinkSchema = z.object({ employeeId: id, token: text(z.string().trim().min(1).max(512)) });

/** The employee's phone opens the link; marks the browser "pending registration". */
export const registerStartSchema = z.object({ token: text(z.string().trim().min(1).max(512)) });

/** Manager locks out a lost or compromised phone. */
export const revokeDeviceSessionSchema = z.object({ id });

export type NfcDirectionInput = z.infer<typeof nfcDirectionSchema>;
export type CreateNfcCardInput = z.infer<typeof createNfcCardSchema>;
export type UpdateNfcCardInput = z.infer<typeof updateNfcCardSchema>;
export type NfcCardRefInput = z.infer<typeof nfcCardRefSchema>;
export type SetNfcCardActiveInput = z.infer<typeof setNfcCardActiveSchema>;
export type NfcTapInput = z.infer<typeof nfcTapSchema>;
export type SendRegistrationLinkInput = z.infer<typeof sendRegistrationLinkSchema>;
export type EmailRegistrationLinkInput = z.infer<typeof emailRegistrationLinkSchema>;
export type RegisterStartInput = z.infer<typeof registerStartSchema>;
export type RevokeDeviceSessionInput = z.infer<typeof revokeDeviceSessionSchema>;
