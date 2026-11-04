import type { RouterOutputs } from '../../lib/trpc';

export type NfcCard = RouterOutputs['nfcCard']['list'][number];

export const inputClass = 'w-full rounded-lg border border-edge bg-white px-3 py-2 text-sm text-ink outline-none focus:border-rust';
