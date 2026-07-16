import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { createStationTRPCClient, STATION_TOKEN, type RouterOutputs } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { Icon } from '../../components/ui/Icon';
import { Card, Button } from '../../components/ui/primitives';

// This is a kiosk-style page with no user session — both calls it makes
// (register, facilityOptions) are stationProcedure, so a single scoped
// station client serves the whole page.
const stationClient = createStationTRPCClient(STATION_TOKEN);

type Shipment = RouterOutputs['shipment']['register'];

interface FormState {
    supplier: string;
    reference: string;
    contents: string;
    quantity: string;
    weightKg: string;
    condition: 'GOOD' | 'DAMAGED';
    conditionNote: string;
    receivedBy: string;
    expectedAt: string;
    receivedAt: string;
    facilityId: string;
}

function nowLocalInput(): string {
    // Local datetime in the format required by <input type="datetime-local">
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function emptyForm(): FormState {
    return {
        supplier: '',
        reference: '',
        contents: '',
        quantity: '',
        weightKg: '',
        condition: 'GOOD',
        conditionNote: '',
        receivedBy: '',
        expectedAt: '',
        receivedAt: nowLocalInput(),
        facilityId: '',
    };
}

export default function ShipmentRegisterPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>(emptyForm);
    const [registered, setRegistered] = useState<Shipment | null>(null);

    const facilityQuery = useQuery({
        queryKey: ['station', 'shipment.facilityOptions'],
        queryFn: () => stationClient.shipment.facilityOptions.query(),
        staleTime: 60_000,
    });
    const registerMutation = useMutation({
        mutationFn: (input: Parameters<typeof stationClient.shipment.register.mutate>[0]) =>
            stationClient.shipment.register.mutate(input),
        onSuccess: (shipment) => setRegistered(shipment),
    });
    const { hasModule, isLoading } = useSubscription();

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas text-muted">
                <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
            </div>
        );
    }

    if (!hasModule('SHIPMENTS')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
                <UpgradePrompt module="SHIPMENTS" />
            </div>
        );
    }

    const set = (field: keyof FormState, value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }) as FormState);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.supplier.trim()) return;

        const quantity = form.quantity.trim() === '' ? undefined : Number(form.quantity);
        const weightKg = form.weightKg.trim() === '' ? undefined : Number(form.weightKg);

        registerMutation.mutate({
            supplier: form.supplier.trim(),
            reference: form.reference.trim() || undefined,
            contents: form.contents.trim() || undefined,
            quantity: Number.isFinite(quantity) ? quantity : undefined,
            weightKg: Number.isFinite(weightKg) ? weightKg : undefined,
            condition: form.condition,
            conditionNote: form.conditionNote.trim() || undefined,
            receivedBy: form.receivedBy.trim() || undefined,
            expectedAt: form.expectedAt ? new Date(`${form.expectedAt}T00:00:00`).toISOString() : undefined,
            receivedAt: form.receivedAt ? new Date(form.receivedAt).toISOString() : undefined,
            facilityId: form.facilityId || undefined,
        });
    };

    const handleRecordAnother = () => {
        setRegistered(null);
        setForm(emptyForm());
        registerMutation.reset();
    };

    return (
        <div className="min-h-screen bg-canvas p-6">
            <div aria-hidden className="pointer-events-none fixed inset-0 data-grid-bg opacity-40" />
            <div className="relative mx-auto max-w-2xl">
                <header className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-edge/70 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-olive-deep text-bone-light">
                            <Icon name="box" width={22} height={22} />
                        </span>
                        <div>
                            <h1 className="font-display text-lg font-extrabold text-olive-deep">Record Supplier Shipment</h1>
                            <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">Log an inbound package the moment it arrives</p>
                        </div>
                    </div>
                    <Link to="/app/shipments">
                        <Button variant="secondary">
                            <Icon name="grid" width={15} height={15} /> Dashboard
                        </Button>
                    </Link>
                </header>

                {registered ? (
                    <ShipmentConfirmation
                        shipment={registered}
                        onRecordAnother={handleRecordAnother}
                        onView={() => navigate(`/app/shipments/${registered.id}`)}
                    />
                ) : (
                    <Card as="section" className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Field
                                label="Supplier / vendor"
                                required
                                value={form.supplier}
                                onChange={(v) => set('supplier', v)}
                                placeholder="Acme Supplies Ltd"
                            />

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field
                                    label="Tracking / PO number"
                                    value={form.reference}
                                    onChange={(v) => set('reference', v)}
                                    placeholder="PO-10234 / 1Z999AA1"
                                />
                                <Field
                                    label="Received by"
                                    value={form.receivedBy}
                                    onChange={(v) => set('receivedBy', v)}
                                    placeholder="Guard / staff name"
                                />
                                <Field
                                    label="Quantity (boxes/items)"
                                    type="number"
                                    value={form.quantity}
                                    onChange={(v) => set('quantity', v)}
                                    placeholder="12"
                                />
                                <Field
                                    label="Weight (kg)"
                                    type="number"
                                    value={form.weightKg}
                                    onChange={(v) => set('weightKg', v)}
                                    placeholder="45.5"
                                />
                                <Field
                                    label="Expected arrival"
                                    type="date"
                                    value={form.expectedAt}
                                    onChange={(v) => set('expectedAt', v)}
                                />
                                <Field
                                    label="Received at"
                                    type="datetime-local"
                                    value={form.receivedAt}
                                    onChange={(v) => set('receivedAt', v)}
                                />
                            </div>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-olive-deep">Destination facility</span>
                                <select
                                    value={form.facilityId}
                                    onChange={(e) => set('facilityId', e.target.value)}
                                    className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
                                >
                                    <option value="">— None —</option>
                                    {(facilityQuery.data ?? []).map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-olive-deep">Contents description</span>
                                <textarea
                                    value={form.contents}
                                    onChange={(e) => set('contents', e.target.value)}
                                    rows={3}
                                    placeholder="e.g. 12x replacement filters, 3x sensor units"
                                    className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
                                />
                            </label>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-olive-deep">Condition</span>
                                    <select
                                        value={form.condition}
                                        onChange={(e) => set('condition', e.target.value as 'GOOD' | 'DAMAGED')}
                                        className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
                                    >
                                        <option value="GOOD">Good</option>
                                        <option value="DAMAGED">Damaged</option>
                                    </select>
                                </label>
                                <Field
                                    label="Condition note"
                                    value={form.conditionNote}
                                    onChange={(v) => set('conditionNote', v)}
                                    placeholder="Dented corner, etc. (optional)"
                                />
                            </div>

                            {registerMutation.isError && (
                                <div className="rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
                                    {registerMutation.error.message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={registerMutation.isPending || !form.supplier.trim()}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-rust py-3.5 text-sm font-semibold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
                            >
                                <Icon name="box" width={16} height={16} />
                                {registerMutation.isPending ? 'Recording…' : 'Record Shipment'}
                            </button>
                        </form>
                    </Card>
                )}
            </div>
        </div>
    );
}

interface FieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: FieldProps) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-olive-deep">
                {label}
                {required && <span className="text-rust"> *</span>}
            </span>
            <input
                type={type}
                value={value}
                required={required}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
            />
        </label>
    );
}

interface ConfirmationProps {
    shipment: Shipment;
    onRecordAnother: () => void;
    onView: () => void;
}

function ShipmentConfirmation({ shipment, onRecordAnother, onView }: ConfirmationProps) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6">
                <div className="mb-4 flex items-center gap-2 text-live">
                    <Icon name="check" width={20} height={20} />
                    <span className="font-semibold">Shipment recorded</span>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-bone-light/50 p-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-olive-deep text-bone-light">
                        <Icon name="box" width={22} height={22} />
                    </span>
                    <div>
                        <p className="font-display text-lg font-extrabold text-olive-deep">{shipment.supplier}</p>
                        <p className="font-mono text-sm text-muted">{shipment.shipmentCode}</p>
                    </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <Detail label="Reference" value={shipment.reference} />
                    <Detail label="Quantity" value={shipment.quantity != null ? String(shipment.quantity) : null} />
                    <Detail label="Weight" value={shipment.weightKg != null ? `${shipment.weightKg} kg` : null} />
                    <Detail label="Condition" value={shipment.condition === 'DAMAGED' ? 'Damaged' : 'Good'} />
                    <Detail label="Facility" value={shipment.facilityName} />
                    <Detail label="Received by" value={shipment.receivedBy} />
                </dl>

                <div className="mt-6 flex gap-3">
                    <button onClick={onView} className="flex-1 rounded-xl bg-olive-deep py-3 font-semibold text-bone-light transition-colors hover:bg-olive-deep/90">
                        View details
                    </button>
                    <button onClick={onRecordAnother} className="flex-1 rounded-xl border border-edge bg-white py-3 font-semibold text-olive-deep transition-colors hover:bg-bone-light">
                        Record another
                    </button>
                </div>
            </Card>
        </motion.div>
    );
}

function Detail({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="kicker">{label}</dt>
            <dd className="mt-0.5 font-medium text-ink">{value ?? '—'}</dd>
        </div>
    );
}
