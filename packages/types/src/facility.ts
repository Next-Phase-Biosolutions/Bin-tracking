// ─── Facility Types ────────────────────────────────────────────

export type FacilityType = 'PROCESSING' | 'RENDERING';

export interface Facility {
    id: string;
    name: string;
    type: FacilityType;
    address: string;
    lat: number;
    lng: number;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Station {
    id: string;
    facilityId: string;
    token: string;
    label: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface FacilityWithStations extends Facility {
    stations: Station[];
}
