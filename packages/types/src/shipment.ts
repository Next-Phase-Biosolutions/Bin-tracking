// ─── Supplier Shipment Types ──────────────────────────────────

export type ShipmentCondition = 'GOOD' | 'DAMAGED';

export interface Shipment {
    id: string;
    shipmentCode: string;
    supplier: string;
    reference: string | null;
    contents: string | null;
    quantity: number | null;
    weightKg: number | null;
    condition: ShipmentCondition;
    conditionNote: string | null;
    receivedBy: string | null;
    expectedAt: Date | null;
    receivedAt: Date;
    facilityId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

/** Shipment with its optional destination facility name resolved. */
export interface ShipmentWithFacility extends Shipment {
    facilityName: string | null;
}
