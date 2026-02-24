// ─── @bin-tracker/types ───────────────────────────────────────
// Shared TypeScript types for the Bin Tracking System

export type { Facility, Station, FacilityType, FacilityWithStations } from './facility.js';
export type { Bin, BinType, BinStatus, Urgency, BinWithType, BinWithDetails } from './bin.js';
export type {
    BinCycle,
    CycleStatus,
    ComplianceResult,
    CycleWithCountdown,
} from './cycle.js';
export type { EventLog, EventType } from './event.js';
export type { User, UserRole, UserInfo } from './user.js';
export type {
    ApiSuccess,
    ApiError,
    ApiResponse,
    PaginationInput,
    PaginatedResponse,
    DashboardStats,
} from './api.js';
export type {
    FacilityWithDetails,
    CycleWithDetails,
    FacilityWithCycleCounts,
    BinWithActiveCycle,
} from './prisma.js';
