// ─── Event Types ──────────────────────────────────────────────

export type EventType = 'BIN_STARTED' | 'PICKED_UP' | 'DELIVERED';

export interface EventLog {
    id: string;
    cycleId: string;
    eventType: EventType;
    timestamp: Date;
    stationId: string | null;
    driverId: string | null;
    locationLat: number | null;
    locationLng: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
}
