import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import { buildMerkleRoot } from '../lib/merkle.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type CycleForAnchoring = Awaited<ReturnType<typeof fetchCycles>>[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchCycles(start: Date, end: Date) {
    return prisma.binCycle.findMany({
        where: {
            status: 'COMPLETED',
            deliveredAt: { gte: start, lte: end },
        },
        include: {
            bin: {
                include: {
                    binType: { select: { organType: true, dkHours: true } },
                },
            },
            facility: { select: { id: true, name: true } },
            destination: { select: { id: true, name: true } },
        },
        orderBy: { deliveredAt: 'asc' },
    });
}

/**
 * Canonical JSON representation of a cycle.
 * Keys are sorted and stable — same input always produces same output.
 * Never change this function after mainnet go-live (would break historical proofs).
 */
function canonicalize(cycle: CycleForAnchoring): string {
    return JSON.stringify({
        id: cycle.id,
        bin_qr: cycle.bin.qrCode,
        organ_type: cycle.bin.binType.organType,
        dk_hours: cycle.bin.binType.dkHours,
        facility_id: cycle.facilityId,
        destination_id: cycle.destinationId ?? null,
        started_at: cycle.startedAt.toISOString(),
        deadline: cycle.deadline.toISOString(),
        picked_up_at: cycle.pickedUpAt?.toISOString() ?? null,
        delivered_at: cycle.deliveredAt?.toISOString() ?? null,
        compliance: cycle.complianceResult ?? null,
    });
}

function buildStats(cycles: CycleForAnchoring[]) {
    const total = cycles.length;
    const onTime = cycles.filter((c) => c.complianceResult === 'ON_TIME').length;

    const byOrgan: Record<string, { count: number; on_time: number }> = {};
    const byFacility: Record<string, { count: number; on_time: number }> = {};

    for (const c of cycles) {
        const organ = c.bin.binType.organType;
        const fac = c.facility.name;
        const ok = c.complianceResult === 'ON_TIME';

        if (!byOrgan[organ]) byOrgan[organ] = { count: 0, on_time: 0 };
        byOrgan[organ]!.count++;
        if (ok) byOrgan[organ]!.on_time++;

        if (!byFacility[fac]) byFacility[fac] = { count: 0, on_time: 0 };
        byFacility[fac]!.count++;
        if (ok) byFacility[fac]!.on_time++;
    }

    return {
        total_cycles: total,
        on_time: onTime,
        late: total - onTime,
        compliance_rate: total > 0 ? ((onTime / total) * 100).toFixed(1) : '100.0',
        by_organ: byOrgan,
        by_facility: byFacility,
    };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const blockchainService = {
    /**
     * Aggregate daily completed cycles and build the CIP-25 metadata payload.
     * Everything is computed server-side; frontend only handles wallet interaction.
     */
    async getDailySummary(fromDate: string, toDate: string) {
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRe.test(fromDate) || !dateRe.test(toDate)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dates must be YYYY-MM-DD.' });
        }

        const start = new Date(`${fromDate}T00:00:00.000Z`);
        const end = new Date(`${toDate}T23:59:59.999Z`);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid date value.' });
        }

        const cycles = await fetchCycles(start, end);

        const rangeLabel = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;

        if (cycles.length === 0) {
            return {
                fromDate,
                toDate,
                rangeLabel,
                cycleIds: [] as string[],
                totalCycles: 0,
                stats: null,
                merkleRoot: null,
                cip25Payload: null,
                alreadyAnchored: false,
            };
        }

        const alreadyAnchored = false; // MVP: allow re-minting for any date range

        const leaves = cycles.map(canonicalize);
        const merkleRoot = buildMerkleRoot(leaves);
        const stats = buildStats(cycles);

        // Asset name encodes the date range — unique per range
        const assetName = fromDate === toDate
            ? `BIN_OPS_${fromDate.replace(/-/g, '')}`
            : `BIN_OPS_${fromDate.replace(/-/g, '')}TO${toDate.replace(/-/g, '')}`;

        // Resolve the NFT image URL.
        // CARDANO_NFT_IMAGE_CID can be a full ipfs:// or https:// URL, or just a bare CID.
        const rawImageCid = process.env['CARDANO_NFT_IMAGE_CID'] ?? '';
        const imageUrl = rawImageCid.startsWith('ipfs://') || rawImageCid.startsWith('https://')
            ? rawImageCid
            : rawImageCid
                ? `ipfs://${rawImageCid}`
                : 'ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';

        // Cardano metadata strings are limited to 64 bytes each.
        // CIP-25 allows image to be an array of strings that are concatenated.
        const nftImage = imageUrl.length <= 64
            ? imageUrl
            : imageUrl.match(/.{1,64}/g) ?? [imageUrl];

        const cip25Payload = {
            __assetName: assetName,
            name: `Bin Operations - ${rangeLabel}`,
            image: nftImage,
            description: 'Immutable record of bin spoilage tracking operations.',
            from_date: fromDate,
            to_date: toDate,
            system: 'bin-tracker-v1',
            summary: {
                total_cycles: stats.total_cycles,
                on_time: stats.on_time,
                late: stats.late,
                compliance_rate: stats.compliance_rate,
            },
            by_organ: stats.by_organ,
            by_facility: stats.by_facility,
            merkle_root: merkleRoot,
        };

        return {
            fromDate,
            toDate,
            rangeLabel,
            cycleIds: cycles.map((c) => c.id),
            totalCycles: cycles.length,
            stats,
            merkleRoot,
            cip25Payload,
            alreadyAnchored,
        };
    },

    /**
     * Called by the frontend after the transaction is confirmed on-chain.
     * Marks all provided cycle IDs as anchored.
     *
     * Idempotent: only updates cycles where anchored = false.
     * This means a retry after a network error is safe.
     */
    async confirmAnchor(cycleIds: string[], txHash: string) {
        // txHash on Cardano is always exactly 64 hex characters
        if (!/^[0-9a-f]{64}$/i.test(txHash)) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Invalid TX hash. Must be a 64-character hex string.',
            });
        }

        if (cycleIds.length === 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'No cycle IDs provided.' });
        }

        // Idempotent: WHERE anchored = false prevents re-updating already-anchored rows
        const result = await prisma.binCycle.updateMany({
            where: {
                id: { in: cycleIds },
                anchored: false, // critical idempotency guard
            },
            data: {
                anchored: true,
                anchorTxHash: txHash,
            },
        });

        return {
            updated: result.count,
            txHash,
        };
    },
};
