// ─── Employee Types ───────────────────────────────────────────

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

export interface Employee {
    id: string;
    employeeCode: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    position: string | null;
    status: EmployeeStatus;
    qrCode: string;
    createdAt: Date;
    updatedAt: Date;
}
