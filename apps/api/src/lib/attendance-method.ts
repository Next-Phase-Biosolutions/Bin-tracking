import { prisma } from '@bin-tracker/db';
import type { AttendanceMethod } from '@prisma/client';
import { AppError } from './app-error.js';

/**
 * Which clock-in method an organization uses. Exactly one is active: NFC tag taps
 * (the default) or the original QR badge scan. An organization with no Settings row
 * (one that predates provisioning) is treated as NFC, the default.
 */
export async function getAttendanceMethod(orgId: string): Promise<AttendanceMethod> {
    const row = await prisma.settings.findUnique({ where: { organizationId: orgId }, select: { attendanceMethod: true } });
    return row?.attendanceMethod ?? 'NFC';
}

/**
 * Refuses a clock-in path that is not the organization's active method. The QR code,
 * the guard scanner and the scan procedure all stay in the codebase; they are simply
 * switched off while the organization is on NFC, and the NFC tap and registration are
 * switched off while it is on QR. Flipping the setting is also the rollback.
 */
export async function assertAttendanceMethod(orgId: string, required: AttendanceMethod): Promise<void> {
    const active = await getAttendanceMethod(orgId);
    if (active === required) return;
    if (required === 'QR') {
        throw new AppError('QR_DISABLED', 'PRECONDITION_FAILED', 'QR badge scanning is turned off for your organization. Employees clock in by tapping an NFC card.');
    }
    throw new AppError('NFC_DISABLED', 'PRECONDITION_FAILED', 'NFC tap attendance is turned off for your organization.');
}
