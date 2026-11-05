import { useEffect, useState } from 'react';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { refreshQuery } from '../../lib/refresh';
import { Badge } from '../../components/ui/primitives';
import { ConfirmButton } from '../nfc/ConfirmButton';
import { CopyField } from '../nfc/CopyField';
import { describeAdminError } from '../nfc/errors';

type Device = RouterOutputs['deviceRegistration']['listDevices'][number];
type Employee = { id: string; fullName: string; status: 'ACTIVE' | 'INACTIVE' };

const day = (d: Date) => d.toLocaleDateString([], { dateStyle: 'medium' });

/** Phone column: how many phones the employee has registered, and a dialog to manage them. */
export function EmployeePhoneCell({ employee, devices }: { employee: Employee; devices: Device[] }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <div className="flex items-center gap-2 whitespace-nowrap">
                {devices.length > 0 ? <Badge tone="good" className="whitespace-nowrap">{devices.length === 1 ? '1 phone' : `${devices.length} phones`}</Badge> : <Badge tone="idle" className="whitespace-nowrap">Not set up</Badge>}
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={`Manage phone for ${employee.fullName}`}
                    className="rounded-lg border border-edge bg-white px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-olive-deep transition-colors hover:border-rust hover:bg-rust/5 hover:text-rust"
                >
                    Manage
                </button>
            </div>
            {open && <PhoneModal employee={employee} devices={devices} onClose={() => setOpen(false)} />}
        </>
    );
}

function PhoneModal({ employee, devices, onClose }: { employee: Employee; devices: Device[]; onClose: () => void }) {
    const utils = trpc.useUtils();
    useEffect(() => {
        // A dialog you can only dismiss with the mouse is a keyboard trap.
        const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const sendLink = trpc.deviceRegistration.sendLink.useMutation();
    const revoke = trpc.deviceRegistration.revokeDevice.useMutation({ onSuccess: () => refreshQuery(utils.deviceRegistration.listDevices) });
    const canLink = employee.status === 'ACTIVE';

    return (
        <div role="dialog" aria-modal="true" aria-label={`Phone for ${employee.fullName}`} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
            <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
                <h2 className="font-display text-lg font-extrabold text-olive-deep">{employee.fullName}’s phone</h2>

                <h3 className="mt-4 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Registered phones</h3>
                {devices.length === 0 ? (
                    <p className="mt-1 text-sm text-muted">No phone is registered yet, so this employee cannot tap in.</p>
                ) : (
                    <ul className="mt-2 divide-y divide-edge/40 rounded-xl border border-edge/60">
                        {devices.map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                <span>
                                    <span className="font-medium text-ink">{d.deviceLabel ?? 'Phone'}</span>
                                    <span className="block text-xs text-muted">
                                        registered {day(d.createdAt)}{d.lastUsedAt ? ` · last used ${day(d.lastUsedAt)}` : ''}
                                    </span>
                                </span>
                                <ConfirmButton tone="danger" confirmLabel="Revoke phone" ariaLabel={`Revoke ${d.deviceLabel ?? 'phone'}`} disabled={revoke.isPending} onConfirm={() => revoke.mutate({ id: d.id })}>
                                    Revoke
                                </ConfirmButton>
                            </li>
                        ))}
                    </ul>
                )}
                {revoke.isError && <p role="alert" className="mt-2 text-sm text-rust">{describeAdminError(revoke.error)}</p>}

                <h3 className="mt-5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Set up a phone</h3>
                {!canLink && <p className="mt-1 text-sm text-muted">This employee is inactive. Reactivate them before setting up a phone.</p>}
                <button
                    type="button"
                    disabled={!canLink || sendLink.isPending}
                    onClick={() => sendLink.mutate({ employeeId: employee.id })}
                    className="mt-2 rounded-xl bg-olive-deep px-4 py-2 text-sm font-semibold text-bone-light hover:bg-olive-deep/90 disabled:opacity-40"
                >
                    {sendLink.isPending ? 'Creating…' : sendLink.data ? 'Create a new link' : 'Create registration link'}
                </button>
                {sendLink.isError && <p role="alert" className="mt-2 text-sm text-rust">{describeAdminError(sendLink.error)}</p>}
                {sendLink.data && (
                    <div className="mt-3 space-y-2">
                        <CopyField value={sendLink.data.link} label={`Registration link for ${employee.fullName}`} />
                        <p className="text-xs text-muted">
                            Works once and expires {sendLink.data.expiresAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}. Send it to {employee.fullName}; they open it on
                            their phone, then tap an NFC card. If it opens inside WhatsApp, they should open it in Chrome or Safari instead.
                        </p>
                    </div>
                )}

                <button type="button" onClick={onClose} className="mt-6 text-sm font-medium text-rust hover:underline">Close</button>
            </div>
        </div>
    );
}
