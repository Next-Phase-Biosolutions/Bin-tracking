import { randomBytes, randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { Employee } from '@bin-tracker/db';
import type {
    EmployeeRegisterInput,
    EmployeeListInput,
} from '@bin-tracker/validators';
import { handlePrismaError } from '../lib/errors.js';

// Unambiguous alphabet (no 0/O/1/I) for human-readable employee codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateEmployeeCode(): string {
    const bytes = randomBytes(6);
    let code = '';
    for (const byte of bytes) {
        code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
    return `EMP-${code}`;
}

function generateQrToken(): string {
    return `ATT-${randomUUID()}`;
}

export const employeeService = {
    /**
     * Register an employee (one-time) and mint a unique, permanent QR token.
     * Retries on the rare code/token collision.
     */
    async register(input: EmployeeRegisterInput, organizationId: string): Promise<Employee> {
        const MAX_ATTEMPTS = 5;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            try {
                return await prisma.employee.create({
                    data: {
                        employeeCode: generateEmployeeCode(),
                        qrCode: generateQrToken(),
                        fullName: input.fullName,
                        email: input.email ?? null,
                        phone: input.phone ?? null,
                        department: input.department ?? null,
                        position: input.position ?? null,
                        organizationId,
                    },
                });
            } catch (error: unknown) {
                // P2002 = unique collision on employeeCode/qrCode — retry with new values.
                const isCollision =
                    typeof error === 'object' &&
                    error !== null &&
                    'code' in error &&
                    (error as { code?: string }).code === 'P2002';
                if (isCollision && attempt < MAX_ATTEMPTS - 1) continue;
                handlePrismaError(error);
            }
        }

        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not generate a unique employee code. Please retry.',
        });
    },

    async list(input: EmployeeListInput): Promise<Employee[]> {
        return prisma.employee.findMany({
            where: input.status ? { status: input.status } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    },

    async getById(id: string): Promise<Employee> {
        const employee = await prisma.employee.findUnique({ where: { id } });
        if (!employee) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Employee not found',
            });
        }
        return employee;
    },
};
