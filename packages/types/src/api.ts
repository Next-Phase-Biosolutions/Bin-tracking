// ─── API Response Types ───────────────────────────────────────

export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationInput {
    /** Cursor for cursor-based pagination */
    cursor?: string;
    /** Number of items per page (default: 20, max: 100) */
    limit?: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    /** Cursor to the next page, null if no more pages */
    nextCursor: string | null;
    /** Total count of matching records (for UI display) */
    totalCount: number;
}

export interface DashboardStats {
    totalActiveBins: number;
    totalOverdue: number;
    totalCompletedToday: number;
    complianceRate: number;
    byFacility: Array<{
        facilityId: string;
        facilityName: string;
        activeBins: number;
        overdueBins: number;
    }>;
    byUrgency: Array<{
        urgency: string;
        count: number;
    }>;
}
