import { randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { Shipment } from '@bin-tracker/db';
import type {
    ShipmentRegisterInput,
    ShipmentListInput,
} from '@bin-tracker/validators';
import type { ShipmentWithFacility } from '@bin-tracker/types';
import { handlePrismaError } from '../lib/errors.js';

// Unambiguous alphabet (no 0/O/1/I) for human-readable shipment codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateShipmentCode(): string {
    const bytes = randomBytes(6);
    let code = '';
    for (const byte of bytes) {
        code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
    return `SHP-${code}`;
}

type ShipmentRow = Shipment & { facility: { name: string } | null };

function toWithFacility(row: ShipmentRow): ShipmentWithFacility {
    const { facility, ...shipment } = row;
    return { ...shipment, facilityName: facility?.name ?? null };
}

export const shipmentService = {
    /**
     * Record an inbound supplier shipment on arrival and mint a unique code.
     * Retries on the rare code collision.
     */
    async register(input: ShipmentRegisterInput, organizationId: string): Promise<ShipmentWithFacility> {
        const MAX_ATTEMPTS = 5;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            try {
                const row = await prisma.shipment.create({
                    data: {
                        shipmentCode: generateShipmentCode(),
                        supplier: input.supplier,
                        reference: input.reference ?? null,
                        contents: input.contents ?? null,
                        quantity: input.quantity ?? null,
                        weightKg: input.weightKg ?? null,
                        condition: input.condition,
                        conditionNote: input.conditionNote ?? null,
                        receivedBy: input.receivedBy ?? null,
                        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
                        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
                        facilityId: input.facilityId ?? null,
                        organizationId,
                    },
                    include: { facility: { select: { name: true } } },
                });
                return toWithFacility(row);
            } catch (error: unknown) {
                // P2002 = unique collision on shipmentCode — retry with a new code.
                const isCollision =
                    typeof error === 'object' &&
                    error !== null &&
                    'code' in error &&
                    (error as { code?: string }).code === 'P2002';
                if (isCollision && attempt < MAX_ATTEMPTS - 1) continue;
                handlePrismaError(error);
            }
        }

        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not generate a unique shipment code. Please retry.',
        });
    },

    async list(orgId: string, input: ShipmentListInput): Promise<ShipmentWithFacility[]> {
        const rows = await prisma.shipment.findMany({
            where: { organizationId: orgId, ...(input.condition ? { condition: input.condition } : {}) },
            orderBy: { receivedAt: 'desc' },
            take: input.limit,
            include: { facility: { select: { name: true } } },
        });
        return rows.map(toWithFacility);
    },

    async getById(orgId: string, id: string): Promise<ShipmentWithFacility> {
        const row = await prisma.shipment.findUnique({
            where: { id },
            include: { facility: { select: { name: true } } },
        });
        // Cross-org mismatch reports as NOT_FOUND (never FORBIDDEN) — same
        // discipline as cycle.service.ts.
        if (!row || row.organizationId !== orgId) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
        }
        return toWithFacility(row);
    },

    /** Lightweight id/name list of facilities for the arrival form dropdown. */
    async facilityOptions(orgId: string): Promise<{ id: string; name: string }[]> {
        return prisma.facility.findMany({
            where: { organizationId: orgId, deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
    },
};
