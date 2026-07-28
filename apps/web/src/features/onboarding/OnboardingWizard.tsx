import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Users, CheckCircle2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../context/AuthContext';
import { MARKETING_URL } from '../../lib/marketingUrl';

type Step = 'org' | 'facility' | 'invite';

const STEPS: { key: Step; label: string }[] = [
    { key: 'org', label: 'Organization' },
    { key: 'facility', label: 'First facility' },
    { key: 'invite', label: 'Invite team' },
];

/**
 * Post-signup setup wizard (Task 18). Runs auth.bootstrap on mount so it's
 * safe to land on directly (page refresh mid-flow, or a returning org-less
 * account) — not just as a redirect target right after SignupPage. If the
 * account already has an org, this immediately bounces to the dashboard.
 *
 * Steps: create org -> create first facility -> invite teammates
 * (invitation.create, Task 19). Sending an invite is optional — "Skip for
 * now" / "Done" always lets the user finish onboarding without inviting
 * anyone. Facility-floor tablets need no pairing step: they sign in with a
 * normal member account like any other device.
 */
export default function OnboardingWizard() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const bootstrapMutation = trpc.auth.bootstrap.useMutation();
    const [checked, setChecked] = useState(false);

    const [step, setStep] = useState<Step>('org');

    useEffect(() => {
        if (loading) return;
        if (!user) {
            window.location.href = `${MARKETING_URL}/login`;
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
        <div className="min-h-screen bg-canvas p-6">
            <div className="mx-auto max-w-2xl">
                <StepProgress currentIndex={stepIndex} />

                {step === 'org' && <OrgStep onDone={() => setStep('facility')} />}
                {step === 'facility' && <FacilityStep onDone={() => setStep('invite')} />}
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
                                    ? 'bg-olive-deep text-bone-light'
                                    : i === currentIndex
                                      ? 'bg-rust text-canvas'
                                      : 'bg-bone text-muted'
                            }`}
                        >
                            {i < currentIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                        </div>
                        <span className="text-xs font-medium text-muted">{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className="mx-2 h-0.5 flex-1 bg-edge" />}
                </li>
            ))}
        </ol>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return <div className="rounded-2xl border border-edge/60 bg-white p-6 shadow-card">{children}</div>;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-muted">{children}</div>;
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
                    className="w-full rounded-lg border border-edge px-4 py-2 text-ink focus:border-rust focus:outline-none"
                />
                {createOrg.isError && <ErrorBanner message={createOrg.error.message} />}
                <SubmitButton pending={createOrg.isPending} disabled={!name.trim()} label="Create organization" />
            </form>
        </Card>
    );
}

// ─── Step 2: First facility ────────────────────────────────────────────

function FacilityStep({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'PROCESSING' | 'RENDERING'>('PROCESSING');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');

    const createFacility = trpc.facility.create.useMutation({
        onSuccess: () => onDone(),
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
                    <span className="mb-1 block text-sm font-medium text-olive-deep">Type</span>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as 'PROCESSING' | 'RENDERING')}
                        className="w-full rounded-lg border border-edge px-4 py-2 text-ink focus:border-rust focus:outline-none"
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

// ─── Step 3: Invite teammates ──────────────────────────────────────────

type InviteRole = 'ADMIN' | 'OPS_MANAGER' | 'DRIVER' | 'WORKER';

const ROLE_OPTIONS: { value: InviteRole; label: string }[] = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'OPS_MANAGER', label: 'Ops Manager' },
    { value: 'DRIVER', label: 'Driver' },
    { value: 'WORKER', label: 'Worker' },
];

function InviteStep({ onDone }: { onDone: () => void }) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<InviteRole>('WORKER');
    const [sentTo, setSentTo] = useState<string | null>(null);

    const createInvitation = trpc.invitation.create.useMutation({
        onSuccess: () => {
            setSentTo(email.trim());
            setEmail('');
        },
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        createInvitation.mutate({ email: email.trim(), role });
    };

    return (
        <Card>
            <StepHeader icon={<Users className="h-5 w-5" />} title="Invite your team" />
            <p className="mb-6 text-sm text-muted">
                Send a teammate an invite now, or skip and invite them later from your dashboard.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="teammate@example.com"
                />
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-olive-deep">Role</span>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as InviteRole)}
                        className="w-full rounded-lg border border-edge px-4 py-2 text-ink focus:border-rust focus:outline-none"
                    >
                        {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </label>
                {createInvitation.isError && <ErrorBanner message={createInvitation.error.message} />}
                {sentTo && (
                    <div className="rounded-lg bg-live/10 px-4 py-3 text-sm text-olive-deep">
                        Invitation sent to {sentTo}.
                    </div>
                )}
                <SubmitButton pending={createInvitation.isPending} disabled={!email.trim()} label="Send invite" />
            </form>
            <button
                type="button"
                onClick={onDone}
                className="mt-3 w-full rounded-xl border border-edge py-3 text-sm font-bold text-olive-deep transition-colors hover:bg-bone-light"
            >
                {sentTo ? 'Done' : 'Skip for now'}
            </button>
        </Card>
    );
}

// ─── Shared bits ────────────────────────────────────────────────────────

function StepHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rust/10 text-rust">
                {icon}
            </div>
            <h2 className="font-display text-lg font-bold text-olive-deep">{title}</h2>
        </div>
    );
}

function ErrorBanner({ message }: { message: string }) {
    return <div className="rounded-lg bg-rust/10 px-4 py-3 text-sm text-rust">{message}</div>;
}

function SubmitButton({ pending, disabled, label }: { pending: boolean; disabled: boolean; label: string }) {
    return (
        <button
            type="submit"
            disabled={pending || disabled}
            className="w-full rounded-xl bg-rust py-3 text-sm font-bold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
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
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-olive-deep">{label}</span>
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-edge px-4 py-2 text-ink focus:border-rust focus:outline-none"
            />
        </label>
    );
}
