import { describe, expect, it } from 'vitest';
import { isPoolTimeout, isSerializationFailure, mutexKeysInUse, withKeyMutex } from './with-lock.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('withKeyMutex', () => {
    it('runs same-key work strictly in arrival order', async () => {
        const order: number[] = [];
        await Promise.all(
            [1, 2, 3].map((n) =>
                withKeyMutex('emp-a', async () => {
                    await sleep(10 - n * 3);
                    order.push(n);
                }),
            ),
        );
        expect(order).toEqual([1, 2, 3]);
    });

    it('runs different keys in parallel', async () => {
        const started = Date.now();
        await Promise.all(['a', 'b', 'c'].map((k) => withKeyMutex(k, () => sleep(60))));
        expect(Date.now() - started).toBeLessThan(150);
    });

    it('releases the key when a job throws, and leaves nothing behind', async () => {
        await expect(withKeyMutex('emp-x', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
        await expect(withKeyMutex('emp-x', async () => 'ok')).resolves.toBe('ok');
        expect(mutexKeysInUse()).toBe(0);
    });
});

describe('isSerializationFailure', () => {
    it.each([
        ['Prisma P2034', { code: 'P2034' }],
        ['adapter cause.kind', { cause: { kind: 'TransactionWriteConflict' } }],
        ['adapter meta.driverAdapterError.cause.kind', { meta: { driverAdapterError: { cause: { kind: 'TransactionWriteConflict' } } } }],
        ['postgres 40001', { cause: { originalCode: '40001' } }],
        ['postgres deadlock 40P01', { meta: { driverAdapterError: { cause: { originalCode: '40P01' } } } }],
        ['message only', { message: 'DriverAdapterError: TransactionWriteConflict' }],
        ['deadlock message', { message: 'deadlock detected' }],
    ])('recognises %s', (_name, err) => {
        expect(isSerializationFailure(err)).toBe(true);
    });

    it.each([[null], [undefined], [{}], [{ code: 'P2002' }], [{ message: 'unique constraint failed' }], [new Error('nope')]])(
        'does not retry %j',
        (err) => {
            expect(isSerializationFailure(err)).toBe(false);
        },
    );
});

describe('isPoolTimeout', () => {
    it('maps P2024 and P2028 to overload, nothing else', () => {
        expect(isPoolTimeout({ code: 'P2024' })).toBe(true);
        expect(isPoolTimeout({ code: 'P2028' })).toBe(true);
        expect(isPoolTimeout({ code: 'P2034' })).toBe(false);
        expect(isPoolTimeout(null)).toBe(false);
    });
});
