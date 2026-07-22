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
    note: string | null;
    /** Session bounds so a fixer can see when the shift started. */
    checkInAt: Date;
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

// ─── Platform-admin payroll monitoring ─────────────────────────────────────
// Read-only, cross-org views for the platform-admin panel. Never expose
// decrypted bank fields here — bankAccountLast4 (a plaintext mask source) is
// the only account identifier that may appear.

/** One org's PAYROLL module state plus its most recent run, for the overview list. */
export interface PayrollOrgOverview {
    orgId: string;
    orgName: string;
    payrollEnabled: boolean;
    latestRun: PayrollRunSummary | null;
    heldCount: number;
    failedCount: number;
}

/** One employee's pay line within a run, as shown to a platform admin. */
export interface PayrollAdminLineItemView {
    id: string;
    employeeId: string;
    fullName: string;
    bankAccountLast4: string | null;
    grossCents: number;
    payoutStatus: PayoutStatus;
}

/** One held-back session within a run, as shown to a platform admin. */
export interface PayrollAdminExceptionView {
    id: string;
    employeeId: string;
    fullName: string;
    type: PayrollExceptionType;
    resolved: boolean;
    note: string | null;
}

/** Full run detail for the platform-admin drill-down. */
export interface PayrollAdminRunDetail {
    id: string;
    orgId: string;
    orgName: string;
    period: string;
    status: PayrollRunStatus;
    currency: string;
    totalEmployees: number;
    totalGrossCents: number;
    computedAt: Date | null;
    createdAt: Date;
    lineItems: PayrollAdminLineItemView[];
    exceptions: PayrollAdminExceptionView[];
}
