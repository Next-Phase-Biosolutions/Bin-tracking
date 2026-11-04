import { describe, expect, it } from 'vitest';
import {
    createNfcCardSchema,
    updateNfcCardSchema,
    nfcCardRefSchema,
    setNfcCardActiveSchema,
    nfcTapSchema,
    sendRegistrationLinkSchema,
    registerStartSchema,
    revokeDeviceSessionSchema,
} from '../src/nfc.schema.js';
import { attendanceApproveSessionSchema } from '../src/attendance.schema.js';

const NUL = 'a\u0000b';

describe('NFC schemas', () => {
    it('accepts the three card directions and nothing else', () => {
        for (const direction of ['IN', 'OUT', 'BOTH']) {
            expect(createNfcCardSchema.safeParse({ label: 'Door', direction, chipUid: '04A1' }).success).toBe(true);
        }
        expect(createNfcCardSchema.safeParse({ label: 'Door', direction: 'both', chipUid: '04A1' }).success).toBe(false);
        expect(createNfcCardSchema.safeParse({ label: 'Door', direction: 'TOGGLE', chipUid: '04A1' }).success).toBe(false);
    });

    it('trims and requires a non-empty label and chipUid, capped at 200 characters', () => {
        expect(createNfcCardSchema.safeParse({ label: '   ', direction: 'IN', chipUid: 'x' }).success).toBe(false);
        expect(createNfcCardSchema.safeParse({ label: 'ok', direction: 'IN', chipUid: '' }).success).toBe(false);
        expect(createNfcCardSchema.safeParse({ label: 'x'.repeat(200), direction: 'IN', chipUid: 'x' }).success).toBe(true);
        expect(createNfcCardSchema.safeParse({ label: 'x'.repeat(201), direction: 'IN', chipUid: 'x' }).success).toBe(false);
    });

    it('treats a card update as partial: only the id is required', () => {
        expect(updateNfcCardSchema.safeParse({ id: 'c1' }).success).toBe(true);
        expect(updateNfcCardSchema.safeParse({ id: 'c1', label: '' }).success).toBe(false);
        expect(updateNfcCardSchema.safeParse({ label: 'x' }).success).toBe(false);
    });

    it('rejects a NUL byte in every free-text and id field', () => {
        expect(createNfcCardSchema.safeParse({ label: NUL, direction: 'IN', chipUid: 'x' }).success).toBe(false);
        expect(createNfcCardSchema.safeParse({ label: 'ok', direction: 'IN', chipUid: NUL }).success).toBe(false);
        expect(updateNfcCardSchema.safeParse({ id: NUL }).success).toBe(false);
        expect(nfcCardRefSchema.safeParse({ id: NUL }).success).toBe(false);
        expect(setNfcCardActiveSchema.safeParse({ id: NUL, active: true }).success).toBe(false);
        expect(nfcTapSchema.safeParse({ cardId: NUL }).success).toBe(false);
        expect(sendRegistrationLinkSchema.safeParse({ employeeId: NUL }).success).toBe(false);
        expect(registerStartSchema.safeParse({ token: NUL }).success).toBe(false);
        expect(revokeDeviceSessionSchema.safeParse({ id: NUL }).success).toBe(false);
    });

    it('still accepts ordinary unicode (accents, CJK, emoji, apostrophes)', () => {
        for (const label of ['Entrée Café', '入口', 'Door 🚪', "O'Brien dock"]) {
            expect(createNfcCardSchema.safeParse({ label, direction: 'IN', chipUid: 'x' }).success).toBe(true);
        }
    });

    it('bounds the registration token and card id lengths', () => {
        expect(registerStartSchema.safeParse({ token: 't'.repeat(512) }).success).toBe(true);
        expect(registerStartSchema.safeParse({ token: 't'.repeat(513) }).success).toBe(false);
        expect(nfcTapSchema.safeParse({ cardId: 'c'.repeat(201) }).success).toBe(false);
        expect(nfcTapSchema.safeParse({}).success).toBe(false);
    });
});

describe('attendanceApproveSessionSchema', () => {
    it('allows approving as-is (no checkOutAt)', () => {
        expect(attendanceApproveSessionSchema.safeParse({ id: 's1' }).success).toBe(true);
    });

    it('requires checkOutAt, when given, to be an ISO datetime with an offset', () => {
        expect(attendanceApproveSessionSchema.safeParse({ id: 's1', checkOutAt: '2031-05-01T22:00:00Z' }).success).toBe(true);
        expect(attendanceApproveSessionSchema.safeParse({ id: 's1', checkOutAt: '2031-05-01T22:00:00+05:30' }).success).toBe(true);
        expect(attendanceApproveSessionSchema.safeParse({ id: 's1', checkOutAt: 'tomorrow' }).success).toBe(false);
        expect(attendanceApproveSessionSchema.safeParse({ id: 's1', checkOutAt: '2031-05-01T22:00:00' }).success).toBe(false);
    });
});
