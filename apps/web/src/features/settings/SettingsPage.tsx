import { useState, type FormEvent, type ReactNode } from 'react';
import { trpc } from '../../lib/trpc';
import { supabase } from '../../lib/supabase.ts';
import { useAuth } from '../../context/AuthContext';
import { MARKETING_URL } from '../../lib/marketingUrl';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Button, Badge, LiveDot } from '../../components/ui/primitives';

const ROLE_OPTIONS = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'OPS_MANAGER', label: 'Ops Manager' },
    { value: 'DRIVER', label: 'Driver' },
    { value: 'WORKER', label: 'Worker' },
] as const;

type Role = (typeof ROLE_OPTIONS)[number]['value'];

const roleLabel = (role: string): string => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;

const inputCls =
    'w-full rounded-lg border border-edge/80 bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-olive focus:bg-white focus:outline-none';

const selectCls =
    'rounded-lg border border-edge/80 bg-canvas px-3 py-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-olive-deep transition-colors focus:border-olive focus:outline-none';

/** Card header row: mono kicker + title left, annotation right. */
function PanelHead({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
    return (
        <div className="flex items-end justify-between gap-3 border-b border-edge/50 px-6 py-5">
            <div>
                <p className="kicker">{kicker}</p>
                <h2 className="mt-1 font-display text-lg font-extrabold tracking-tight text-olive-deep">{title}</h2>
            </div>
            {right}
        </div>
    );
}

export default function SettingsPage() {
    const me = trpc.auth.me.useQuery();

    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader
                title="Settings"
                subtitle="Your profile and team"
                icon={<Icon name="badge" width={20} height={20} />}
            />
            <div className="space-y-6">
                <ProfileSection name={me.data?.name} />
                {me.data?.orgRole === 'ADMIN' ? (
                    <>
                        <MembersCard myUserId={me.data.id} />
                        <InvitesCard />
                    </>
                ) : null}
            </div>
        </div>
    );
}

// ─── Profile ───────────────────────────────────────────────────────────────

function ProfileSection({ name }: { name?: string }) {
    const { user } = useAuth();
    const utils = trpc.useUtils();
    const [draft, setDraft] = useState<string | null>(null);
    const [resetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    const updateProfile = trpc.auth.updateProfile.useMutation({
        onSuccess: () => {
            setDraft(null);
            void utils.auth.me.invalidate();
        },
    });

    const value = draft ?? name ?? '';
    const dirty = draft !== null && draft.trim() !== (name ?? '') && draft.trim().length > 0;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!dirty) return;
        updateProfile.mutate({ name: value.trim() });
    };

    const sendPasswordReset = async () => {
        if (!user?.email) return;
        setResetError(null);
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${MARKETING_URL}/reset-password`,
        });
        if (error) setResetError(error.message);
        else setResetSent(true);
    };

    return (
        <Card>
            <PanelHead kicker="Operator profile" title="Profile" />
            <form onSubmit={handleSubmit} className="px-6 py-5">
                <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                        <span className="mb-1.5 block font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
                            Name
                        </span>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => setDraft(e.target.value)}
                            maxLength={200}
                            className={inputCls}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
                            Email
                        </span>
                        <input
                            type="email"
                            value={user?.email ?? ''}
                            disabled
                            className="w-full cursor-not-allowed rounded-lg border border-edge/50 bg-bone-light/60 px-3.5 py-2.5 text-sm text-muted"
                        />
                        <span className="mt-1.5 block text-xs leading-relaxed text-muted">
                            Your email is your sign-in identity and can&apos;t be changed here.
                        </span>
                    </label>
                </div>

                {updateProfile.isError && <p className="mt-4 text-sm text-rust">{updateProfile.error.message}</p>}
                {resetError && <p className="mt-4 text-sm text-rust">{resetError}</p>}

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-edge/40 pt-5">
                    <Button type="submit" disabled={!dirty || updateProfile.isPending}>
                        {updateProfile.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void sendPasswordReset()} disabled={resetSent}>
                        {resetSent ? 'Reset email sent' : 'Change password'}
                    </Button>
                    {updateProfile.isSuccess && draft === null && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-live">
                            <Icon name="check" width={14} height={14} /> Profile updated
                        </span>
                    )}
                    {resetSent && <span className="text-sm text-muted">Check your inbox for a reset link.</span>}
                </div>
            </form>
        </Card>
    );
}

// ─── Members roster (admins only) ──────────────────────────────────────────

function MembersCard({ myUserId }: { myUserId: string }) {
    const utils = trpc.useUtils();
    const members = trpc.invitation.members.useQuery();
    const [error, setError] = useState<string | null>(null);

    const refresh = () => void utils.invitation.members.invalidate();
    const updateRole = trpc.invitation.updateMemberRole.useMutation({
        onSuccess: refresh,
        onError: (e) => setError(e.message),
    });
    const removeMember = trpc.invitation.removeMember.useMutation({
        onSuccess: refresh,
        onError: (e) => setError(e.message),
    });

    const count = members.data?.length;

    return (
        <Card>
            <PanelHead
                kicker="Crew roster"
                title="Members"
                right={
                    count !== undefined ? (
                        <span className="pb-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
                            {count} active
                        </span>
                    ) : undefined
                }
            />
            <div className="px-6 py-2">
                {error && <p className="pt-3 text-sm text-rust">{error}</p>}
                {members.isLoading && <p className="py-4 text-sm text-muted">Loading roster…</p>}
                <ul className="divide-y divide-edge/40">
                    {(members.data ?? []).map((m) => {
                        const self = m.userId === myUserId;
                        return (
                            <li key={m.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rust/85 font-display text-sm font-bold text-canvas">
                                    {m.name.slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-olive-deep">
                                        {m.name}
                                        {self ? <LiveDot /> : null}
                                        {self ? <span className="text-xs font-normal text-muted">you</span> : null}
                                    </p>
                                    <p className="truncate text-xs text-muted">{m.email}</p>
                                </div>
                                {self ? (
                                    <Badge tone="complete">{roleLabel(m.role)}</Badge>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={m.role}
                                            onChange={(e) => {
                                                setError(null);
                                                updateRole.mutate({ userId: m.userId, role: e.target.value as Role });
                                            }}
                                            disabled={updateRole.isPending}
                                            aria-label={`Role for ${m.name}`}
                                            className={selectCls}
                                        >
                                            {ROLE_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => {
                                                setError(null);
                                                if (window.confirm(`Remove ${m.name} from the organization?`)) {
                                                    removeMember.mutate({ userId: m.userId });
                                                }
                                            }}
                                            disabled={removeMember.isPending}
                                            className="rounded-lg px-2.5 py-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-rust transition-colors hover:bg-rust/10"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </Card>
    );
}

// ─── Invites (admins only) ─────────────────────────────────────────────────

function InvitesCard() {
    const utils = trpc.useUtils();
    const invites = trpc.invitation.list.useQuery();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('WORKER');
    const [sentTo, setSentTo] = useState<string | null>(null);

    const refresh = () => void utils.invitation.list.invalidate();
    const createInvitation = trpc.invitation.create.useMutation({
        onSuccess: (data) => {
            setSentTo(data.email);
            setEmail('');
            refresh();
        },
    });
    const revoke = trpc.invitation.revoke.useMutation({ onSuccess: refresh });

    const handleInvite = (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSentTo(null);
        createInvitation.mutate({ email: email.trim(), role });
    };

    const pending = invites.data ?? [];

    return (
        <Card>
            <PanelHead
                kicker="Pending clearances"
                title="Invite your team"
                right={
                    pending.length > 0 ? (
                        <span className="pb-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
                            {pending.length} pending
                        </span>
                    ) : undefined
                }
            />
            <div className="px-6 py-5">
                <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
                    <label className="min-w-56 flex-1">
                        <span className="mb-1.5 block font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
                            Email
                        </span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="teammate@example.com"
                            className={inputCls}
                        />
                    </label>
                    <label>
                        <span className="mb-1.5 block font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
                            Role
                        </span>
                        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={selectCls}>
                            {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Button type="submit" variant="rust" disabled={!email.trim() || createInvitation.isPending}>
                        {createInvitation.isPending ? 'Sending…' : 'Send invite'}
                    </Button>
                </form>

                {createInvitation.isError && <p className="mt-3 text-sm text-rust">{createInvitation.error.message}</p>}
                {sentTo && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-live">
                        <Icon name="check" width={14} height={14} /> Invitation sent to {sentTo}
                    </p>
                )}

                {pending.length > 0 ? (
                    <ul className="mt-5 divide-y divide-edge/40 border-t border-edge/40">
                        {pending.map((inv) => {
                            const expired = new Date(inv.expiresAt).getTime() < Date.now();
                            return (
                                <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-olive-deep">{inv.email}</p>
                                        <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-widest text-muted">
                                            {roleLabel(inv.role)} ·{' '}
                                            {expired
                                                ? 'Expired — re-invite to send a fresh link'
                                                : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                    {expired ? <Badge tone="warn">Expired</Badge> : <Badge tone="active">Sent</Badge>}
                                    <button
                                        onClick={() => revoke.mutate({ invitationId: inv.id })}
                                        disabled={revoke.isPending}
                                        className="rounded-lg px-2.5 py-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-rust transition-colors hover:bg-rust/10"
                                    >
                                        Revoke
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
            </div>
        </Card>
    );
}
