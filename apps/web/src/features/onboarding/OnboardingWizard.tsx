import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Building2, MapPin, QrCode as QrCodeIcon, Users, CheckCircle2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../context/AuthContext';

type Step = 'org' | 'facility' | 'station' | 'invite';

const STEPS: { key: Step; label: string }[] = [
    { key: 'org', label: 'Organization' },
    { key: 'facility', label: 'First facility' },
    { key: 'station', label: 'Tablet setup' },
    { key: 'invite', label: 'Invite team' },
];

/**
 * Post-signup setup wizard (Task 18). Runs auth.bootstrap on mount so it's
 * safe to land on directly (page refresh mid-flow, or a returning org-less
 * account) — not just as a redirect target right after SignupPage. If the
 * account already has an org, this immediately bounces to the dashboard.
 *
 * Steps: create org -> create first facility -> show station token QR for
 * tablet setup -> invite teammates. The invite step is a placeholder here —
 * real invitation sending is Task 19, out of scope for this task.
 */
export default function OnboardingWizard() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const bootstrapMutation = trpc.auth.bootstrap.useMutation();
    const [checked, setChecked] = useState(false);

    const [step, setStep] = useState<Step>('org');
    const [facilityId, setFacilityId] = useState<string | null>(null);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            navigate('/login', { replace: true });
            return;
        }
        if (checked) return;
        setChecked(true);
        bootstrapMutation.mutate(undefined, {
            onSuccess: ({ needsOrg }) => {
                if (!needsOrg) navigate('/app/dashboard', { replace: true });
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, user, checked]);

    if (loading || !checked || bootstrapMutation.isPending) {
        return <CenteredMessage>Loading…</CenteredMessage>;
    }

    const stepIndex = STEPS.findIndex((s) => s.key === step);

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-2xl">
                <StepProgress currentIndex={stepIndex} />

                {step === 'org' && <OrgStep onDone={() => setStep('facility')} />}
                {step === 'facility' && (
                    <FacilityStep
                        onDone={(id) => {
                            setFacilityId(id);
                            setStep('station');
                        }}
                    />
                )}
                {step === 'station' && facilityId && (
                    <StationStep facilityId={facilityId} onDone={() => setStep('invite')} />
                )}
                {step === 'invite' && <InviteStep onDone={() => navigate('/app/dashboard', { replace: true })} />}
            </div>
        </div>
    );
}

function StepProgress({ currentIndex }: { currentIndex: number }) {
    return (
        <ol className="mb-8 flex items-center justify-between">
            {STEPS.map((s, i) => (
                <li key={s.key} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1">
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                i < currentIndex
                                    ? 'bg-emerald-500 text-white'
                                    : i === currentIndex
                                      ? 'bg-[#3d5aa8] text-white'
                                      : 'bg-gray-200 text-gray-500'
                            }`}
                        >
                            {i < currentIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                        </div>
                        <span className="text-xs font-medium text-gray-500">{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className="mx-2 h-0.5 flex-1 bg-gray-200" />}
                </li>
            ))}
        </ol>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">{children}</div>;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-400">{children}</div>;
}

// ─── Step 1: Organization ──────────────────────────────────────────────

function OrgStep({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState('');
    const createOrg = trpc.auth.createOrganization.useMutation({ onSuccess: onDone });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        createOrg.mutate({ name: name.trim() });
    };

    return (
        <Card>
            <StepHeader icon={<Building2 className="h-5 w-5" />} title="Name your organization" />
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Processing Co."
                    autoFocus
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#3d5aa8] focus:ring-[#3d5aa8]"
                />
                {createOrg.isError && <ErrorBanner message={createOrg.error.message} />}
                <SubmitButton pending={createOrg.isPending} disabled={!name.trim()} label="Create organization" />
            </form>
        </Card>
    );
}

// ─── Step 2: First facility ────────────────────────────────────────────

function FacilityStep({ onDone }: { onDone: (facilityId: string) => void }) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'PROCESSING' | 'RENDERING'>('PROCESSING');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');

    const createFacility = trpc.facility.create.useMutation({
        onSuccess: (facility) => facility && onDone(facility.id),
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const latNum = Number(lat);
        const lngNum = Number(lng);
        if (!name.trim() || !address.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) return;
        createFacility.mutate({ name: name.trim(), type, address: address.trim(), lat: latNum, lng: lngNum });
    };

    return (
        <Card>
            <StepHeader icon={<MapPin className="h-5 w-5" />} title="Add your first facility" />
            <form onSubmit={handleSubmit} className="space-y-4">
                <TextField label="Facility name" value={name} onChange={setName} placeholder="Main Plant" />
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Type</span>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as 'PROCESSING' | 'RENDERING')}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#3d5aa8] focus:ring-[#3d5aa8]"
                    >
                        <option value="PROCESSING">Processing</option>
                        <option value="RENDERING">Rendering</option>
                    </select>
                </label>
                <TextField label="Address" value={address} onChange={setAddress} placeholder="123 Main St" />
                <div className="grid grid-cols-2 gap-4">
                    <TextField label="Latitude" value={lat} onChange={setLat} placeholder="41.8781" />
                    <TextField label="Longitude" value={lng} onChange={setLng} placeholder="-87.6298" />
                </div>
                {createFacility.isError && <ErrorBanner message={createFacility.error.message} />}
                <SubmitButton
                    pending={createFacility.isPending}
                    disabled={!name.trim() || !address.trim() || !lat || !lng}
                    label="Add facility"
                />
            </form>
        </Card>
    );
}

// ─── Step 3: Station QR ────────────────────────────────────────────────

function StationStep({ facilityId, onDone }: { facilityId: string; onDone: () => void }) {
    const createStation = trpc.facility.createStation.useMutation();
    const requested = useRef(false);

    useEffect(() => {
        if (requested.current) return;
        requested.current = true;
        createStation.mutate({ facilityId });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facilityId]);

    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const token = createStation.data?.token;

    useEffect(() => {
        if (!token) return;
        let active = true;
        QRCode.toDataURL(token, { width: 280, margin: 2, errorCorrectionLevel: 'M' }).then((url) => {
            if (active) setQrDataUrl(url);
        });
        return () => {
            active = false;
        };
    }, [token]);

    return (
        <Card>
            <StepHeader icon={<QrCodeIcon className="h-5 w-5" />} title="Set up a tablet" />
            <p className="mb-4 text-sm text-gray-600">
                Scan this code from the tablet at your facility to pair it as a bin-tracking station.
            </p>

            {createStation.isError && <ErrorBanner message={createStation.error.message} />}

            <div className="mb-6 flex h-[280px] w-[280px] items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white mx-auto">
                {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Station pairing QR code" className="h-full w-full" />
                ) : (
                    <span className="text-sm text-gray-400">{createStation.isPending ? 'Generating…' : ''}</span>
                )}
            </div>

            <button
                type="button"
                onClick={onDone}
                disabled={!token}
                className="w-full rounded-xl bg-[#3d5aa8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2d4898] disabled:opacity-50"
            >
                Continue
            </button>
        </Card>
    );
}

// ─── Step 4: Invite teammates (placeholder — real sending is Task 19) ─

function InviteStep({ onDone }: { onDone: () => void }) {
    return (
        <Card>
            <StepHeader icon={<Users className="h-5 w-5" />} title="Invite your team" />
            <p className="mb-6 text-sm text-gray-600">
                Teammate invitations are coming next — you&apos;ll be able to invite them from your dashboard
                settings shortly. For now, you&apos;re all set.
            </p>
            <button
                type="button"
                onClick={onDone}
                className="w-full rounded-xl bg-[#3d5aa8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2d4898]"
            >
                Go to dashboard
            </button>
        </Card>
    );
}

// ─── Shared bits ────────────────────────────────────────────────────────

function StepHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d5aa8]/10 text-[#3d5aa8]">
                {icon}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>
    );
}

function ErrorBanner({ message }: { message: string }) {
    return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>;
}

function SubmitButton({ pending, disabled, label }: { pending: boolean; disabled: boolean; label: string }) {
    return (
        <button
            type="submit"
            disabled={pending || disabled}
            className="w-full rounded-xl bg-[#3d5aa8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2d4898] disabled:opacity-50"
        >
            {pending ? 'Saving…' : label}
        </button>
    );
}

function TextField({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#3d5aa8] focus:ring-[#3d5aa8]"
            />
        </label>
    );
}
