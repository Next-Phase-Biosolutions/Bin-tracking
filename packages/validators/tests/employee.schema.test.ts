import { describe, expect, it } from 'vitest';
import { employeeRegisterSchema, employeeListSchema } from '../src/employee.schema.js';

describe('employeeRegisterSchema', () => {
    it('accepts a minimal valid payload (name only)', () => {
        const result = employeeRegisterSchema.safeParse({ fullName: 'Jane Doe' });
        expect(result.success).toBe(true);
    });

    it('rejects an empty name', () => {
        const result = employeeRegisterSchema.safeParse({ fullName: '' });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid email', () => {
        const result = employeeRegisterSchema.safeParse({ fullName: 'Jane', email: 'not-an-email' });
        expect(result.success).toBe(false);
    });

    it('accepts full optional fields', () => {
        const result = employeeRegisterSchema.safeParse({
            fullName: 'Jane Doe',
            email: 'jane@company.com',
            phone: '+1 555 0100',
            department: 'Ops',
            position: 'Technician',
        });
        expect(result.success).toBe(true);
    });
});

describe('employeeListSchema', () => {
    it('accepts a valid status', () => {
        expect(employeeListSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true);
        expect(employeeListSchema.safeParse({}).success).toBe(true);
    });

    it('rejects an unknown status', () => {
        expect(employeeListSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
    });
});
