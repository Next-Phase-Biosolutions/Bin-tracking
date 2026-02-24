// ─── User Types ───────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'OPS_MANAGER' | 'DRIVER' | 'WORKER';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

/** Minimal user info for context / responses (no sensitive data) */
export interface UserInfo {
    id: string;
    name: string;
    role: UserRole;
}
