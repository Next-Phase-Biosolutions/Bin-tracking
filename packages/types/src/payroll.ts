// ─── Payroll Types ────────────────────────────────────────────

export type PayrollRunStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
export type PayoutStatus = 'PENDING' | 'PAID' | 'FAILED' | 'HELD';
export type PayrollExceptionType = 'NO_CHECKOUT' | 'AUTO_CLOSED';

/** One employee's pay line within a run. */
export interface PayrollLineItemView {
    id: string;
    employeeId: string;
    employeeCode: string;
    fullName: string;
    minutes: number;
    hours: number;
    rateCents: number;
    grossCents: number;
    payoutStatus: PayoutStatus;
    payoutRef: string | null;
    paidAt: Date | null;
}

/** A dirty session held back from auto-pay within a run. */
export interface PayrollExceptionView {
    id: string;
    employeeId: string;
    employeeCode: string;
    fullName: string;
    sessionId: string;
    type: PayrollExceptionType;
    resolved: boolean;
}

/** Full payroll run with its line items and exceptions. */
export interface PayrollRunView {
    id: string;
    period: string;
    status: PayrollRunStatus;
    rateCents: number;
    currency: string;
    totalEmployees: number;
    totalMinutes: number;
    totalGrossCents: number;
    computedAt: Date | null;
    createdAt: Date;
    lineItems: PayrollLineItemView[];
    exceptions: PayrollExceptionView[];
}

/** Lightweight run row for list views. */
export interface PayrollRunSummary {
    id: string;
    period: string;
    status: PayrollRunStatus;
    totalEmployees: number;
    totalGrossCents: number;
    currency: string;
    computedAt: Date | null;
    createdAt: Date;
}
