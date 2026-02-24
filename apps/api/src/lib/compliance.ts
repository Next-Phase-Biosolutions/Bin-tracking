import type { ComplianceResult } from '@prisma/client';

/** Determine compliance result based on delivery time vs deadline */
export function calculateCompliance(
    deliveredAt: Date,
    deadline: Date,
): ComplianceResult {
    return deliveredAt <= deadline ? 'ON_TIME' : 'LATE';
}
