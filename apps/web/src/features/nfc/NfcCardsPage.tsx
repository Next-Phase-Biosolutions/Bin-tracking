import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { refreshQuery } from '../../lib/refresh';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Button, Card } from '../../components/ui/primitives';
import { ManagerGate } from './ManagerGate';
import { NfcCardRow } from './NfcCardRow';
import { DIRECTION_LABELS, DIRECTIONS, type Direction } from './directions';
import { describeAdminError } from './errors';
import { inputClass } from './shared';

export default function NfcCardsPage() {
    return (
        <ManagerGate label="NFC cards">
            <NfcCards />
        </ManagerGate>
    );
}

function NfcCards() {
    const utils = trpc.useUtils();
    const list = trpc.nfcCard.list.useQuery(undefined, { staleTime: 10_000 });
    const tagBase = trpc.nfcCard.tagBaseUrl.useQuery(undefined, { staleTime: Infinity });
    const [label, setLabel] = useState('');
    const [direction, setDirection] = useState<Direction>('BOTH');
    const [chipUid, setChipUid] = useState('');

    const create = trpc.nfcCard.create.useMutation({
        onSuccess: async () => {
            setLabel('');
            setChipUid('');
            await refreshQuery(utils.nfcCard.list);
        },
    });

    const cards = list.data ?? [];

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                title="NFC cards"
                subtitle="The tags mounted at your doors. Write each card’s tag URL onto its tag; employees tap it with their registered phone."
                icon={<Icon name="badge" width={22} height={22} />}
            />

            <Card className="mb-6 p-5">
                <h2 className="font-display font-bold text-olive-deep">Add a card</h2>
                <form
                    className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem_1fr_auto] sm:items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        create.mutate({ label, direction, chipUid });
                    }}
                >
                    <Field label="Label">
                        <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main entrance" className={inputClass} />
                    </Field>
                    <Field label="What a tap does">
                        <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)} className={inputClass}>
                            {DIRECTIONS.map((d) => (
                                <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Chip UID">
                        <input required value={chipUid} onChange={(e) => setChipUid(e.target.value)} placeholder="04:A2:… (printed on the tag)" className={`${inputClass} font-mono`} />
                    </Field>
                    <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add card'}</Button>
                </form>
                {create.isError && <p role="alert" className="mt-3 text-sm text-rust">{describeAdminError(create.error)}</p>}
            </Card>

            <Card className="overflow-hidden">
                <div className="border-b border-edge/60 px-5 py-3.5">
                    <h2 className="font-display font-bold text-olive-deep">Cards ({cards.length})</h2>
                </div>
                {list.isLoading ? (
                    <p className="px-5 py-8 text-center text-muted">Loading…</p>
                ) : list.isError ? (
                    <p role="alert" className="px-5 py-8 text-center text-rust">{describeAdminError(list.error)}</p>
                ) : cards.length === 0 ? (
                    <p className="px-5 py-10 text-center text-muted">No cards yet. Add the first one above.</p>
                ) : (
                    <ul className="divide-y divide-edge/40">
                        {cards.map((card) => (
                            <NfcCardRow key={card.id} card={card} tagBase={tagBase.data?.url} />
                        ))}
                    </ul>
                )}
            </Card>

            <p className="mt-4 text-xs text-muted">
                A tap is not proof of physical presence: the card id is just a string in a URL. Treat the tag URL like a shared key and keep the cards somewhere only your
                team can reach.
            </p>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{label}</span>
            {children}
        </label>
    );
}
