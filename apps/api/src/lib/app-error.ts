import { TRPCError } from '@trpc/server';

/**
 * A TRPCError that also carries a stable machine code (`appCode`) the phone
 * pages map to a human message — e.g. NO_SESSION, TOKEN_EXPIRED, SERVER_BUSY.
 * The code is exposed to clients through the tRPC errorFormatter
 * (trpc/trpc.ts); `message` defaults to the same code so logs stay readable.
 */
export class AppError extends TRPCError {
    readonly appCode: string;

    constructor(appCode: string, code: TRPCError['code'], message?: string) {
        super({ code, message: message ?? appCode });
        this.appCode = appCode;
    }
}

/** True when `e` is a Prisma known-request error with this code (e.g. P2002 unique violation). */
export function isPrismaError(e: unknown, code: string): boolean {
    return (e as { code?: unknown } | null)?.code === code;
}
