import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { PackagePlus, CheckCircle2, PackageCheck, LayoutDashboard } from 'lucide-react';
import { trpc, createStationTRPCClient, STATION_TOKEN, type RouterOutputs } from '../../lib/trpc';

// shipment.register requires stationProcedure — scoped to this one call.
// facilityOptions below stays on the normal bearer-gated trpc hook since it's
// protectedProcedure, not stationProcedure — the two auth modes coexist
// because each call carries its own client instead of a shared page flag.
const stationClient = createStationTRPCClient(STATION_TOKEN);

type Shipment = RouterOutputs['shipment']['register'];

const ACCENT = '#043F2E';

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

    const facilityQuery = trpc.shipment.facilityOptions.useQuery(undefined, { staleTime: 60_000 });
    const registerMutation = useMutation({
        mutationFn: (input: Parameters<typeof stationClient.shipment.register.mutate>[0]) =>
            stationClient.shipment.register.mutate(input),
        onSuccess: (shipment) => setRegistered(shipment),
    });

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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-2xl">
                <header className="mb-6 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Record Supplier Shipment</h1>
                        <p className="mt-1 text-sm text-gray-600">
                            Log an inbound package the moment it arrives.
                        </p>
                    </div>
                    <Link
                        to="/app/shipments"
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                    >
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                </header>

                {registered ? (
                    <ShipmentConfirmation
                        shipment={registered}
                        onRecordAnother={handleRecordAnother}
                        onView={() => navigate(`/app/shipments/${registered.id}`)}
                    />
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                    >
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
                            <span className="mb-1 block text-sm font-medium text-gray-700">Destination facility</span>
                            <select
                                value={form.facilityId}
                                onChange={(e) => set('facilityId', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#043F2E] focus:ring-[#043F2E]"
                            >
                                <option value="">— None —</option>
                                {(facilityQuery.data ?? []).map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Contents description</span>
                            <textarea
                                value={form.contents}
                                onChange={(e) => set('contents', e.target.value)}
                                rows={3}
                                placeholder="e.g. 12x replacement filters, 3x sensor units"
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#043F2E] focus:ring-[#043F2E]"
                            />
                        </label>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-gray-700">Condition</span>
                                <select
                                    value={form.condition}
                                    onChange={(e) => set('condition', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#043F2E] focus:ring-[#043F2E]"
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
                            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                                {registerMutation.error.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={registerMutation.isPending || !form.supplier.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-lg font-bold text-white transition-colors disabled:opacity-50"
                            style={{ backgroundColor: ACCENT }}
                        >
                            <PackagePlus className="h-5 w-5" />
                            {registerMutation.isPending ? 'Recording…' : 'Record Shipment'}
                        </button>
                    </form>
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
            <span className="mb-1 block text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </span>
            <input
                type={type}
                value={value}
                required={required}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#043F2E] focus:ring-[#043F2E]"
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
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                <span className="font-semibold">Shipment recorded</span>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: ACCENT }}
                >
                    <PackageCheck className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-lg font-bold text-gray-900">{shipment.supplier}</p>
                    <p className="font-mono text-sm text-gray-500">{shipment.shipmentCode}</p>
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
                <button
                    onClick={onView}
                    className="flex-1 rounded-xl py-3 font-semibold text-white transition-colors"
                    style={{ backgroundColor: ACCENT }}
                >
                    View details
                </button>
                <button
                    onClick={onRecordAnother}
                    className="flex-1 rounded-xl border border-gray-300 bg-white py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                    Record another
                </button>
            </div>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wider text-gray-400">{label}</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{value ?? '—'}</dd>
        </div>
    );
}
