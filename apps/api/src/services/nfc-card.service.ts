import { randomUUID } from 'node:crypto';
import { prisma } from '@bin-tracker/db';
import type { CreateNfcCardInput, UpdateNfcCardInput, SetNfcCardActiveInput } from '@bin-tracker/validators';
import { AppError, isPrismaError } from '../lib/app-error.js';

/**
 * Wall-mounted NFC cards. Every query is scoped to one organization. A card's
 * id (not its chipUid) is what is written into the tag's URL, so editing the
 * label, direction or chipUid never invalidates a tag that is already written.
 */
export const nfcCardService = {
    async list(orgId: string) {
        return prisma.nfcCard.findMany({ where: { organizationId: orgId }, orderBy: { label: 'asc' } });
    },

    async create(orgId: string, input: CreateNfcCardInput) {
        try {
            // The id goes into the tag URL, so it is a random UUID rather than a time-ordered cuid.
            return await prisma.nfcCard.create({ data: { id: randomUUID(), organizationId: orgId, ...input } });
        } catch (e) {
            if (isPrismaError(e, 'P2002')) throw new AppError('DUPLICATE_CHIP_UID', 'CONFLICT', 'A card with this chip UID already exists');
            throw e;
        }
    },

    /** Partial update: only the fields present change. */
    async update(orgId: string, input: UpdateNfcCardInput) {
        const { id, ...changes } = input;
        try {
            const { count } = await prisma.nfcCard.updateMany({ where: { id, organizationId: orgId }, data: changes });
            if (count === 0) throw new AppError('CARD_NOT_FOUND', 'NOT_FOUND');
        } catch (e) {
            if (isPrismaError(e, 'P2002')) throw new AppError('DUPLICATE_CHIP_UID', 'CONFLICT', 'A card with this chip UID already exists');
            throw e;
        }
        return prisma.nfcCard.findFirstOrThrow({ where: { id, organizationId: orgId } });
    },

    async setActive(orgId: string, input: SetNfcCardActiveInput) {
        const { count } = await prisma.nfcCard.updateMany({ where: { id: input.id, organizationId: orgId }, data: { active: input.active } });
        if (count === 0) throw new AppError('CARD_NOT_FOUND', 'NOT_FOUND');
        return prisma.nfcCard.findFirstOrThrow({ where: { id: input.id, organizationId: orgId } });
    },

    /** Always allowed: a card owns no history (events reference employees, not cards). */
    async remove(orgId: string, id: string) {
        const { count } = await prisma.nfcCard.deleteMany({ where: { id, organizationId: orgId } });
        if (count === 0) throw new AppError('CARD_NOT_FOUND', 'NOT_FOUND');
        return { deleted: true as const };
    },
};
