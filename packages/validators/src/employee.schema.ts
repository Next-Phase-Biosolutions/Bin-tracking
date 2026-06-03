import { z } from 'zod';

// ─── Employee Validators ──────────────────────────────────────

export const employeeRegisterSchema = z.object({
    fullName: z.string().min(1, 'Full name is required').max(120),
    email: z.string().email('Invalid email').optional(),
    phone: z.string().max(30).optional(),
    department: z.string().max(80).optional(),
    position: z.string().max(80).optional(),
});

export type EmployeeRegisterInput = z.infer<typeof employeeRegisterSchema>;

export const employeeGetByIdSchema = z.object({
    id: z.string().min(1),
});

export type EmployeeGetByIdInput = z.infer<typeof employeeGetByIdSchema>;

export const employeeListSchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type EmployeeListInput = z.infer<typeof employeeListSchema>;
