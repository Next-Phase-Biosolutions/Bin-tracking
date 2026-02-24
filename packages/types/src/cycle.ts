// ─── Cycle Types ──────────────────────────────────────────────

export type CycleStatus = 'ACTIVE' | 'IN_TRANSIT' | 'COMPLETED';

export type ComplianceResult = 'ON_TIME' | 'LATE';

export interface BinCycle {
    id: string;
    binId: string;
    facilityId: string;
    destinationId: string | null;
    status: CycleStatus;
    startedAt: Date;
    deadline: Date;
    pickedUpAt: Date | null;
    deliveredAt: Date | null;
    driverId: string | null;
    vehicleId: string | null;
    complianceResult: ComplianceResult | null;
    anchored: boolean;
    anchorTxHash: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CycleWithCountdown extends BinCycle {
    /** Milliseconds remaining until deadline. Negative = overdue */
    remainingMs: number;
    /** Human-readable countdown string, e.g. "2h 15m" or "-0h 30m (OVERDUE)" */
    countdownDisplay: string;
    /** Whether the deadline has passed */
    isOverdue: boolean;
}

export interface CycleWithDetails extends CycleWithCountdown {
    bin: {
        id: string;
        qrCode: string;
        binType: {
            organType: string;
            dkHours: number;
            urgency: string;
        };
    };
    facility: {
        id: string;
        name: string;
    };
    destination: {
        id: string;
        name: string;
    } | null;
}
