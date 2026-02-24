import { z } from 'zod';
import { paginationSchema } from './common.schema.js';

// ─── Bin Start (Scan 1 — Tablet) ─────────────────────────────

export const binStartSchema = z.object({
    /** QR code scanned at facility */
    qrCode: z
        .string()
        .min(1, 'QR code is required')
        .max(50, 'QR code too long')
        .regex(/^BIN-[A-Z]+-\d{3}$/, 'Invalid QR code format (expected BIN-TYPE-###)'),
});

export type BinStartInput = z.infer<typeof binStartSchema>;

// ─── Bin Get ──────────────────────────────────────────────────

export const binGetByIdSchema = z.object({
    id: z.string().cuid(),
});

export const binGetByQrCodeSchema = z.object({
    qrCode: z
        .string()
        .min(1, 'QR code is required')
        .max(50, 'QR code too long'),
});

// ─── Bin List ─────────────────────────────────────────────────

export const binListSchema = z.object({
    facilityId: z.string().cuid().optional(),
    status: z.enum(['IDLE', 'ACTIVE', 'IN_TRANSIT']).optional(),
    binTypeId: z.string().cuid().optional(),
}).merge(paginationSchema);

export type BinListInput = z.infer<typeof binListSchema>;
