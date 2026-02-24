import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

/**
 * Transform Prisma errors to user-friendly TRPC errors
 * Handles common Prisma error codes and provides appropriate error messages
 */
export function handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002':
                // Unique constraint violation
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'A record with this value already exists',
                });
            case 'P2025':
                // Record not found
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Record not found',
                });
            case 'P2003':
                // Foreign key constraint violation
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Foreign key constraint failed - related record not found',
                });
            case 'P2014':
                // Relation violation
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'The change violates a required relation',
                });
            default:
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Database error occurred',
                });
        }
    }

    // If it's already a TRPCError, rethrow it
    if (error instanceof TRPCError) {
        throw error;
    }

    // Unknown error
    throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
    });
}
