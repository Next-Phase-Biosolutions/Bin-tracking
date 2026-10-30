import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import { DEFAULT_OFFLINE_AFTER_MINUTES } from '@bin-tracker/types';

const OFFLINE_AFTER_KEY = 'sensor.offlineAfterMinutes';
const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;

function isValidMinutes(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= MIN_MINUTES && value <= MAX_MINUTES;
}

/** Platform-wide settings (not per organization), stored in `platform_settings`. */
export const platformSettings = {
    /** A corrupt stored value falls back to the default rather than breaking every reader. */
    async getOfflineAfterMinutes(): Promise<number> {
        const row = await prisma.platformSetting.findUnique({ where: { key: OFFLINE_AFTER_KEY } });
        return row && isValidMinutes(row.value) ? row.value : DEFAULT_OFFLINE_AFTER_MINUTES;
    },

    async setOfflineAfterMinutes(minutes: number, actorId: string): Promise<void> {
        if (!isValidMinutes(minutes)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `minutes must be a whole number from ${MIN_MINUTES} to ${MAX_MINUTES}` });
        }
        await prisma.platformSetting.upsert({
            where: { key: OFFLINE_AFTER_KEY },
            update: { value: minutes, updatedBy: actorId },
            create: { key: OFFLINE_AFTER_KEY, value: minutes, updatedBy: actorId },
        });
    },
};
