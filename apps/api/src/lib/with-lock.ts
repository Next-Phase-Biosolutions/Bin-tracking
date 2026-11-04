import type { Prisma } from '@prisma/client';
import { prisma } from '@bin-tracker/db';
import { AppError } from './app-error.js';

type Tx = Prisma.TransactionClient;

// ─── In-process FIFO mutex ───────────────────────────────────────────────────
// Duplicate taps from one employee (a double-tap storm) wait HERE, in memory,
// instead of each holding a pooled database connection while queued on the DB
// advisory lock — which starves the pool and fails other employees' taps under
// load. The advisory lock below still guarantees correctness across several API
// instances; this just keeps its waiters off the pool.
const tails = new Map<string, Promise<void>>();

export async function withKeyMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => (release = r));
    const tail = prev.then(() => mine);
    tails.set(key, tail);
    await prev;
    try {
        return await fn();
    } finally {
        release();
        if (tails.get(key) === tail) tails.delete(key); // nobody queued behind us: free the entry
    }
}

/** Number of keys currently held or queued — exposed so tests can prove nothing leaks. */
export const mutexKeysInUse = () => tails.size;

// ─── Retry classification ────────────────────────────────────────────────────

interface DriverErrorShape {
    code?: string;
    message?: string;
    cause?: { kind?: string; originalCode?: string };
    meta?: { driverAdapterError?: { cause?: { kind?: string; originalCode?: string } } };
}

/**
 * True for a Postgres serialization failure or deadlock. With the pg driver
 * adapter these do NOT surface as Prisma P2034: a Serializable conflict arrives
 * as `DriverAdapterError: TransactionWriteConflict`, so checking P2034 alone
 * would turn a concurrent rush into HTTP 500s.
 */
export function isSerializationFailure(e: unknown): boolean {
    const err = (e ?? {}) as DriverErrorShape;
    if (err.code === 'P2034') return true;
    const causes = [err.cause, err.meta?.driverAdapterError?.cause];
    if (causes.some((c) => c?.kind === 'TransactionWriteConflict')) return true;
    if (causes.some((c) => c?.originalCode === '40001' || c?.originalCode === '40P01')) return true;
    return /TransactionWriteConflict|deadlock detected/i.test(String(err.message ?? ''));
}

/** Pool exhausted (P2024) or the transaction could not start in time (P2028). */
export function isPoolTimeout(e: unknown): boolean {
    const code = (e as DriverErrorShape | null)?.code;
    return code === 'P2024' || code === 'P2028';
}

// ─── Per-key advisory lock ───────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const TX_MAX_WAIT_MS = 8_000;
const TX_TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Runs `fn` in a transaction serialized per `key` (use `employee:<id>`): an
 * in-process FIFO queue first, then `pg_advisory_xact_lock` inside the
 * transaction. Two racing taps for one employee can never both see "no open
 * shift"; different employees never block each other.
 *
 * Overload is not a 500: a pool/transaction-start timeout becomes
 * SERVER_BUSY (HTTP 429), which the phone page retries. Serialization failures,
 * deadlocks and any Prisma code in `retryOn` (the one-open-shift unique index
 * is the backstop, so punches pass ['P2002']) are retried with jitter.
 */
export async function withLock<T>(
    key: string,
    fn: (tx: Tx) => Promise<T>,
    options: { retryOn?: readonly string[] } = {},
): Promise<T> {
    return withKeyMutex(key, async () => {
        for (let attempt = 1; ; attempt++) {
            try {
                return await prisma.$transaction(
                    async (tx: Tx) => {
                        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
                        return fn(tx);
                    },
                    { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
                );
            } catch (e) {
                if (isPoolTimeout(e)) throw new AppError('SERVER_BUSY', 'TOO_MANY_REQUESTS');
                const code = (e as DriverErrorShape | null)?.code;
                const retryable = isSerializationFailure(e) || (code !== undefined && options.retryOn?.includes(code));
                if (!retryable || attempt >= MAX_ATTEMPTS) throw e;
                await sleep(25 + Math.random() * 75);
            }
        }
    });
}
