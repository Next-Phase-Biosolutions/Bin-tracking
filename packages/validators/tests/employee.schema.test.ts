import { describe, expect, it } from 'vitest';
import {
    employeeRegisterSchema,
    employeeListSchema,
    employeeBankDetailsSchema,
    employeeBankSubmitSchema,
} from '../src/employee.schema.js';

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

describe('employeeBankDetailsSchema', () => {
    const valid = {
        bankInstitution: '004',
        bankTransit: '12345',
        bankAccount: '7001234',
        accountHolderName: 'Jane Doe',
        accountType: 'CHEQUING',
        email: 'jane@acme.com',
    };

    it('accepts valid Canadian EFT details', () => {
        expect(employeeBankDetailsSchema.safeParse(valid).success).toBe(true);
    });

    // People copy these off a cheque, where they're printed with separators.
    // Stripping must happen BEFORE the length check, or a correct number typed
    // the way it's printed gets rejected — or worse, stored with the dash.
    it.each([
        ['700-1234', '7001234'],
        ['700 1234', '7001234'],
        [' 7001234 ', '7001234'],
    ])('strips separators from %j before validating, storing %j', (input, expected) => {
        const result = employeeBankDetailsSchema.safeParse({ ...valid, bankAccount: input });
        expect(result.success).toBe(true);
        expect(result.data?.bankAccount).toBe(expected);
    });

    it.each([
        ['bankInstitution', '04'],
        ['bankInstitution', '0041'],
        ['bankInstitution', 'abc'],
        ['bankTransit', '1234'],
        ['bankTransit', '123456'],
        ['bankAccount', '700123'], // 6 digits, one short
        ['bankAccount', '1234567890123'], // 13 digits, one over
        ['bankAccount', '70012ab'],
    ])('rejects %s = %j', (field, value) => {
        expect(employeeBankDetailsSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
    });

    it('accepts the 7 and 12 digit account boundaries', () => {
        expect(employeeBankDetailsSchema.safeParse({ ...valid, bankAccount: '1234567' }).success).toBe(true);
        expect(employeeBankDetailsSchema.safeParse({ ...valid, bankAccount: '123456789012' }).success).toBe(true);
    });

    it('rejects an account type outside CHEQUING/SAVINGS', () => {
        expect(employeeBankDetailsSchema.safeParse({ ...valid, accountType: 'CHECKING' }).success).toBe(false);
    });

    it('rejects a blank account holder name', () => {
        expect(employeeBankDetailsSchema.safeParse({ ...valid, accountHolderName: '   ' }).success).toBe(false);
    });

    it('requires a valid email — Zum Rails needs it for the payee', () => {
        expect(employeeBankDetailsSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    });
});

describe('employeeBankSubmitSchema', () => {
    it('requires the link token alongside the details', () => {
        const details = {
            bankInstitution: '004',
            bankTransit: '12345',
            bankAccount: '7001234',
            accountHolderName: 'Jane Doe',
            accountType: 'CHEQUING',
            email: 'jane@acme.com',
        };
        expect(employeeBankSubmitSchema.safeParse(details).success).toBe(false);
        expect(employeeBankSubmitSchema.safeParse({ ...details, token: 'abc' }).success).toBe(true);
    });
});
