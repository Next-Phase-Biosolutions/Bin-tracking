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

/**
 * A `users` row already exists with a given email under a DIFFERENT id — the
 * only way that happens is a Supabase Auth account for that email existed
 * before, got deleted, and was re-created (Supabase hands out a brand-new
 * `sub` on re-creation; the local row from the old one is still here since
 * `email` is @unique but nothing deletes it when Supabase Auth changes out
 * from under it). Used by both auth.service.ts's bootstrap() and
 * invitation.service.ts's acceptInvitation() — both do a `user.upsert()`
 * keyed on the Supabase-issued id and can hit this identical conflict.
 * The caller can't fix this by retrying — surface it clearly instead of
 * letting the raw Prisma constraint error reach the browser.
 */
export function isEmailConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export const EMAIL_CONFLICT_MESSAGE =
    'An account already exists for this email under a different sign-in record. Contact support to resolve this — signing up again will not fix it.';
