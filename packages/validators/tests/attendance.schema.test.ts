import { describe, expect, it } from 'vitest';
import {
    attendanceScanSchema,
    attendanceSummarySchema,
    attendanceRecentSchema,
} from '../src/attendance.schema.js';

describe('attendanceScanSchema', () => {
    it('requires a non-empty qrCode', () => {
        expect(attendanceScanSchema.safeParse({ qrCode: 'ATT-abc' }).success).toBe(true);
        expect(attendanceScanSchema.safeParse({ qrCode: '' }).success).toBe(false);
    });

    it('allows an optional source', () => {
        expect(attendanceScanSchema.safeParse({ qrCode: 'ATT-abc', source: 'Gate 1' }).success).toBe(true);
    });
});

describe('attendanceSummarySchema', () => {
    it('accepts no range', () => {
        expect(attendanceSummarySchema.safeParse({}).success).toBe(true);
    });

    it('accepts a valid ISO range', () => {
        const result = attendanceSummarySchema.safeParse({
            from: '2026-06-01T00:00:00.000Z',
            to: '2026-06-02T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
    });

    it('rejects a reversed range', () => {
        const result = attendanceSummarySchema.safeParse({
            from: '2026-06-02T00:00:00.000Z',
            to: '2026-06-01T00:00:00.000Z',
        });
        expect(result.success).toBe(false);
    });
});

describe('attendanceRecentSchema', () => {
    it('defaults the limit to 20', () => {
        const result = attendanceRecentSchema.parse({});
        expect(result.limit).toBe(20);
    });

    it('rejects an out-of-range limit', () => {
        expect(attendanceRecentSchema.safeParse({ limit: 0 }).success).toBe(false);
        expect(attendanceRecentSchema.safeParse({ limit: 1000 }).success).toBe(false);
    });
});
