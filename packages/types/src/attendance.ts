// ─── Attendance Types ─────────────────────────────────────────

export type AttendanceEventType = 'CHECK_IN' | 'CHECK_OUT';

export interface WorkSession {
    id: string;
    employeeId: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    durationMin: number | null;
    autoClosed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface AttendanceEvent {
    id: string;
    employeeId: string;
    sessionId: string;
    eventType: AttendanceEventType;
    scannedAt: Date;
    source: string | null;
    createdAt: Date;
}

/** Result returned to the guard scanner after a scan resolves. */
export interface AttendanceScanResult {
    action: AttendanceEventType;
    employeeName: string;
    employeeCode: string;
    sessionId: string;
    occurredAt: Date;
    durationMin: number | null;
    /** True when the scan was within the debounce window and ignored. */
    debounced: boolean;
}

/** Per-employee aggregated hours for the timesheet dashboard. */
export interface EmployeeHoursSummary {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    department: string | null;
    totalMinutes: number;
    sessionCount: number;
    openSession: boolean;
}
