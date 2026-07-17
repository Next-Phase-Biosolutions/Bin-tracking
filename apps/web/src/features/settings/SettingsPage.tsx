import { useState, type FormEvent } from 'react';
import { trpc } from '../../lib/trpc';
import { supabase } from '../../lib/supabase.ts';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Button, Badge } from '../../components/ui/primitives';

const ROLE_OPTIONS = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'OPS_MANAGER', label: 'Ops Manager' },
    { value: 'DRIVER', label: 'Driver' },
    { value: 'WORKER', label: 'Worker' },
] as const;

type Role = (typeof ROLE_OPTIONS)[number]['value'];

const roleLabel = (role: string): string => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;

export default function SettingsPage() {
    const me = trpc.auth.me.useQuery();

    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader title="Settings" subtitle="Your profile and team" icon={<Icon name="badge" width={20} height={20} />} />
            <div className="space-y-6">
                <ProfileSection name={me.data?.name} />
                {me.data?.orgRole === 'ADMIN' ? <TeamSection myUserId={me.data.id} /> : null}
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
        const { error } = await supabase.auth.resetPasswordForEmail(user.email);
        if (error) setResetError(error.message);
        else setResetSent(true);
    };

    return (
        <Card>
            <h2 className="font-display text-lg font-extrabold text-olive-deep">Profile</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-muted">Name</span>
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={200}
                        className="w-full rounded-lg border border-edge px-4 py-2 text-olive-deep focus:border-olive-deep focus:outline-none"
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-muted">Email</span>
                    <input
                        type="email"
                        value={user?.email ?? ''}
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-edge bg-bone-light px-4 py-2 text-muted"
                    />
                    <span className="mt-1 block text-xs text-muted">Your email is your sign-in identity and can&apos;t be changed here.</span>
                </label>
                {updateProfile.isError && <p className="text-sm text-rust">{updateProfile.error.message}</p>}
                {updateProfile.isSuccess && draft === null && <p className="text-sm text-olive-deep">Profile updated.</p>}
                <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={!dirty || updateProfile.isPending}>
                        {updateProfile.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void sendPasswordReset()} disabled={resetSent}>
                        {resetSent ? 'Reset email sent' : 'Change password'}
                    </Button>
                </div>
                {resetError && <p className="text-sm text-rust">{resetError}</p>}
                {resetSent && <p className="text-sm text-muted">Check your inbox for a password-reset link.</p>}
            </form>
        </Card>
    );
}

// ─── Team (admins only) ────────────────────────────────────────────────────

function TeamSection({ myUserId }: { myUserId: string }) {
    return (
        <>
            <MembersCard myUserId={myUserId} />
            <InvitesCard />
        </>
    );
}

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

    return (
        <Card>
            <h2 className="font-display text-lg font-extrabold text-olive-deep">Members</h2>
            {error && <p className="mt-2 text-sm text-rust">{error}</p>}
            <ul className="mt-4 divide-y divide-edge">
                {(members.data ?? []).map((m) => {
                    const self = m.userId === myUserId;
                    return (
                        <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-olive-deep">
                                    {m.name}
                                    {self ? <span className="ml-2 text-xs font-normal text-muted">(you)</span> : null}
                                </p>
                                <p className="truncate text-xs text-muted">{m.email}</p>
                            </div>
                            {self ? (
                                <Badge>{roleLabel(m.role)}</Badge>
                            ) : (
                                <>
                                    <select
                                        value={m.role}
                                        onChange={(e) => {
                                            setError(null);
                                            updateRole.mutate({ userId: m.userId, role: e.target.value as Role });
                                        }}
                                        disabled={updateRole.isPending}
                                        className="rounded-lg border border-edge px-2 py-1.5 text-sm text-olive-deep"
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
                                        className="rounded-md px-2 py-1 text-sm text-rust transition-colors hover:bg-rust/10"
                                    >
                                        Remove
                                    </button>
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
            {members.isLoading && <p className="mt-2 text-sm text-muted">Loading members…</p>}
        </Card>
    );
}

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
            <h2 className="font-display text-lg font-extrabold text-olive-deep">Invite your team</h2>
            <form onSubmit={handleInvite} className="mt-4 flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-sm font-medium text-muted">Email</span>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="teammate@example.com"
                        className="w-full rounded-lg border border-edge px-4 py-2 text-olive-deep focus:border-olive-deep focus:outline-none"
                    />
                </label>
                <label>
                    <span className="mb-1 block text-sm font-medium text-muted">Role</span>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as Role)}
                        className="rounded-lg border border-edge px-3 py-2 text-sm text-olive-deep"
                    >
                        {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </label>
                <Button type="submit" disabled={!email.trim() || createInvitation.isPending}>
                    {createInvitation.isPending ? 'Sending…' : 'Send invite'}
                </Button>
            </form>
            {createInvitation.isError && <p className="mt-2 text-sm text-rust">{createInvitation.error.message}</p>}
            {sentTo && <p className="mt-2 text-sm text-olive-deep">Invitation sent to {sentTo}.</p>}

            {pending.length > 0 ? (
                <>
                    <h3 className="mt-6 text-sm font-semibold text-olive-deep">Pending invites</h3>
                    <ul className="mt-2 divide-y divide-edge">
                        {pending.map((inv) => {
                            const expired = new Date(inv.expiresAt).getTime() < Date.now();
                            return (
                                <li key={inv.id} className="flex flex-wrap items-center gap-3 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-olive-deep">{inv.email}</p>
                                        <p className="text-xs text-muted">
                                            {roleLabel(inv.role)} ·{' '}
                                            {expired
                                                ? 'Expired — re-invite to send a fresh link'
                                                : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                    {expired ? <Badge tone="warn">Expired</Badge> : null}
                                    <button
                                        onClick={() => revoke.mutate({ invitationId: inv.id })}
                                        disabled={revoke.isPending}
                                        className="rounded-md px-2 py-1 text-sm text-rust transition-colors hover:bg-rust/10"
                                    >
                                        Revoke
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            ) : null}
        </Card>
    );
}
