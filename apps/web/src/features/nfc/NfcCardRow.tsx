import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { refreshQuery } from '../../lib/refresh';
import { Badge } from '../../components/ui/primitives';
import { ConfirmButton } from './ConfirmButton';
import { CopyField } from './CopyField';
import { DIRECTION_LABELS, DIRECTIONS, type Direction } from './directions';
import { describeAdminError } from './errors';
import { tagUrl } from './tag-url';
import { inputClass, type NfcCard } from './shared';

const smallButton =
    'rounded-lg border border-edge bg-white px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-olive-deep transition-colors hover:border-rust hover:bg-rust/5 hover:text-rust disabled:opacity-40';

/** One card: its tag URL (with copy), active toggle, edit and delete. */
export function NfcCardRow({ card }: { card: NfcCard }) {
    const utils = trpc.useUtils();
    const [editing, setEditing] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const refresh = () => refreshQuery(utils.nfcCard.list);

    const setActive = trpc.nfcCard.setActive.useMutation({ onSuccess: refresh });
    const remove = trpc.nfcCard.remove.useMutation({ onSuccess: refresh });
    const error = setActive.error ?? remove.error;

    return (
        <li className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{card.label}</span>
                        <Badge tone="complete">{card.direction === 'BOTH' ? 'IN + OUT' : card.direction}</Badge>
                        <Badge tone={card.active ? 'good' : 'idle'}>{card.active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-muted">chip {card.chipUid}</div>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" className={smallButton} onClick={() => setActive.mutate({ id: card.id, active: !card.active })} disabled={setActive.isPending}>
                        {card.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className={smallButton} onClick={() => { setNotice(null); setEditing((v) => !v); }} aria-label={`Edit ${card.label}`}>
                        {editing ? 'Close' : 'Edit'}
                    </button>
                    <ConfirmButton
                        tone="danger"
                        confirmLabel="Delete card"
                        ariaLabel={`Delete ${card.label}`}
                        disabled={remove.isPending}
                        onConfirm={() => remove.mutate({ id: card.id })}
                    >
                        Delete
                    </ConfirmButton>
                </div>
            </div>

            <div className="mt-3">
                <CopyField value={tagUrl(card.id)} label={`Tag URL for ${card.label}`} />
            </div>
            {!card.active && <p className="mt-2 text-xs text-muted">Inactive: a tap on this tag is refused. Tags already written still carry the same URL.</p>}
            {error && <p role="alert" className="mt-2 text-sm text-rust">{describeAdminError(error)}</p>}
            {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}

            {editing && (
                <EditForm
                    card={card}
                    onDone={(message) => {
                        setNotice(message ?? null);
                        if (!message) setEditing(false);
                    }}
                />
            )}
        </li>
    );
}

function EditForm({ card, onDone }: { card: NfcCard; onDone: (notice?: string) => void }) {
    const utils = trpc.useUtils();
    const [label, setLabel] = useState(card.label);
    const [direction, setDirection] = useState<Direction>(card.direction);
    const [chipUid, setChipUid] = useState(card.chipUid);
    const [confirmDirection, setConfirmDirection] = useState(false);

    const update = trpc.nfcCard.update.useMutation({
        onSuccess: async () => {
            await refreshQuery(utils.nfcCard.list);
            onDone();
        },
    });

    // Only the fields that actually changed are sent.
    const changes = {
        ...(label.trim() !== card.label ? { label } : {}),
        ...(direction !== card.direction ? { direction } : {}),
        ...(chipUid.trim() !== card.chipUid ? { chipUid } : {}),
    };
    const directionChanged = 'direction' in changes;

    const submit = () => {
        if (Object.keys(changes).length === 0) return onDone('Nothing has changed.');
        // Changing what a tap does is the one edit that alters behaviour at the door: ask first.
        if (directionChanged && !confirmDirection) return setConfirmDirection(true);
        update.mutate({ id: card.id, ...changes });
    };

    return (
        <form
            aria-label={`Edit ${card.label}`}
            className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-edge/60 bg-bone-light/40 p-4 sm:grid-cols-3"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
            <label className="block text-sm">
                <span className="mb-1 block font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Label</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} aria-label="Label" />
            </label>
            <label className="block text-sm">
                <span className="mb-1 block font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">What a tap does</span>
                <select value={direction} onChange={(e) => { setDirection(e.target.value as Direction); setConfirmDirection(false); }} className={inputClass} aria-label="What a tap does">
                    {DIRECTIONS.map((d) => <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>)}
                </select>
            </label>
            <label className="block text-sm">
                <span className="mb-1 block font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Chip UID</span>
                <input value={chipUid} onChange={(e) => setChipUid(e.target.value)} className={`${inputClass} font-mono`} aria-label="Chip UID" />
            </label>

            {confirmDirection && (
                <p role="alert" className="text-sm text-rust sm:col-span-3">
                    Change this card from <strong>{DIRECTION_LABELS[card.direction]}</strong> to <strong>{DIRECTION_LABELS[direction]}</strong>? Tags already written keep working
                    (their URL doesn’t change) but will behave differently from the next tap.
                </p>
            )}
            {update.isError && <p role="alert" className="text-sm text-rust sm:col-span-3">{describeAdminError(update.error)}</p>}

            <div className="flex gap-2 sm:col-span-3">
                <button type="submit" disabled={update.isPending} className="rounded-xl bg-olive-deep px-4 py-2 text-sm font-semibold text-bone-light hover:bg-olive-deep/90 disabled:opacity-50">
                    {update.isPending ? 'Saving…' : confirmDirection ? 'Confirm change' : 'Save'}
                </button>
            </div>
        </form>
    );
}
