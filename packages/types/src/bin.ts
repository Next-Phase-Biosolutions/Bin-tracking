// ─── Bin Types ────────────────────────────────────────────────

export type BinStatus = 'IDLE' | 'ACTIVE' | 'IN_TRANSIT';

export type Urgency = 'CRITICAL' | 'MEDIUM' | 'STANDARD' | 'LOW';

export interface BinType {
    id: string;
    organType: string;
    dkHours: number;
    urgency: Urgency;
    prefix: string;
    createdAt: Date;
}

export interface Bin {
    id: string;
    qrCode: string;
    binTypeId: string;
    currentFacilityId: string;
    status: BinStatus;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface BinWithType extends Bin {
    binType: BinType;
}

export interface BinWithDetails extends BinWithType {
    currentFacility: {
        id: string;
        name: string;
        type: string;
    };
}
