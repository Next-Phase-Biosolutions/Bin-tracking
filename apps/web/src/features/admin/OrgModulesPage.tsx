import { useState } from 'react';
import type { ReactNode } from 'react';
import { ALL_MODULE_KEYS } from '@bin-tracker/types';
import type { ModuleKey } from '@bin-tracker/types';
import { trpc, type RouterOutputs } from '../../lib/trpc';

type OrgRow = RouterOutputs['admin']['listOrganizations'][number];

const MODULE_LABELS: Record<ModuleKey, string> = {
    ANIMAL_INTAKE: 'Animal Intake',
    WORKFORCE: 'Workforce',
    SHIPMENTS: 'Shipments',
    FORMS: 'Forms',
    FORMS_AI_DIGITIZE: 'Forms AI Digitize',
    BLOCKCHAIN_ANCHOR: 'Blockchain Anchor',
    PAYROLL: 'Payroll',
};

/**
 * Internal, operator-only tool: one row per org, one checkbox column per
 * ModuleKey. Toggling a checkbox always calls admin.toggleModule, which
 * writes an OrganizationModule row with source: 'manual' (Task 12/16) — the
 * override that survives future plan changes. Client-side isPlatformAdmin
 * check below is defense-in-depth only; every actual read/write is gated
 * server-side by platformAdminProcedure.
 */
export default function OrgModulesPage() {
    const whoAmI = trpc.admin.whoAmI.useQuery();

    if (whoAmI.isLoading) {
        return <CenteredMessage>Loading…</CenteredMessage>;
    }
    if (!whoAmI.data?.isPlatformAdmin) {
        return <CenteredMessage>Access denied. Platform admin only.</CenteredMessage>;
    }
    return <OrgModulesTable />;
}

function OrgModulesTable() {
    const utils = trpc.useUtils();
    const listQuery = trpc.admin.listOrganizations.useQuery();
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    const toggleMutation = trpc.admin.toggleModule.useMutation({
        onMutate: async (input) => {
            await utils.admin.listOrganizations.cancel();
            const previous = utils.admin.listOrganizations.getData();

            utils.admin.listOrganizations.setData(undefined, (old) =>
                old?.map((org) => (org.id === input.orgId ? withModuleOverride(org, input.module, input.enabled) : org)),
            );

            return { previous };
        },
        onError: (_err, _input, context) => {
            if (context?.previous) {
                utils.admin.listOrganizations.setData(undefined, context.previous);
            }
        },
        onSettled: () => {
            void utils.admin.listOrganizations.invalidate();
        },
    });

    const rows = listQuery.data ?? [];
    const columnCount = 3 + ALL_MODULE_KEYS.length;

    const handleToggle = (org: OrgRow, moduleKey: ModuleKey, currentlyEnabled: boolean) => {
        const cellKey = `${org.id}:${moduleKey}`;
        setPendingKey(cellKey);
        toggleMutation.mutate(
            { orgId: org.id, module: moduleKey, enabled: !currentlyEnabled },
            { onSettled: () => setPendingKey((key) => (key === cellKey ? null : key)) },
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-6xl">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Organization Modules</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Assign or revoke individual modules per organization, independent of their plan.
                    </p>
                </header>

                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase tracking-wider text-gray-400">
                                <tr>
                                    <th className="px-5 py-3">Organization</th>
                                    <th className="px-5 py-3">Plan</th>
                                    <th className="px-5 py-3">Status</th>
                                    {ALL_MODULE_KEYS.map((key) => (
                                        <th key={key} className="px-3 py-3 text-center">
                                            {MODULE_LABELS[key]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {listQuery.isLoading ? (
                                    <tr>
                                        <td colSpan={columnCount} className="px-5 py-8 text-center text-gray-400">
                                            Loading…
                                        </td>
                                    </tr>
                                ) : listQuery.isError ? (
                                    <tr>
                                        <td colSpan={columnCount} className="px-5 py-8 text-center text-red-600">
                                            {listQuery.error.message}
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columnCount} className="px-5 py-8 text-center text-gray-400">
                                            No organizations yet.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((org) => (
                                        <tr key={org.id}>
                                            <td className="px-5 py-3 font-medium text-gray-900">{org.name}</td>
                                            <td className="px-5 py-3 text-gray-600">{org.plan}</td>
                                            <td className="px-5 py-3 text-gray-600">{org.status}</td>
                                            {ALL_MODULE_KEYS.map((key) => {
                                                const enabled = org.modules.find((m) => m.module === key)?.enabled ?? false;
                                                const cellKey = `${org.id}:${key}`;
                                                const isPending = pendingKey === cellKey && toggleMutation.isPending;
                                                return (
                                                    <td key={key} className="px-3 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={enabled}
                                                            disabled={isPending}
                                                            onChange={() => handleToggle(org, key, enabled)}
                                                            aria-label={`${MODULE_LABELS[key]} for ${org.name}`}
                                                            className="h-4 w-4 rounded border-gray-300 text-[#3d5aa8] focus:ring-[#3d5aa8] disabled:opacity-50"
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function withModuleOverride(org: OrgRow, moduleKey: ModuleKey, enabled: boolean): OrgRow {
    const hasRow = org.modules.some((m) => m.module === moduleKey);
    return {
        ...org,
        modules: hasRow
            ? org.modules.map((m) => (m.module === moduleKey ? { ...m, enabled, source: 'manual' } : m))
            : [...org.modules, { module: moduleKey, enabled, source: 'manual' }],
    };
}

function CenteredMessage({ children }: { children: ReactNode }) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">{children}</div>;
}
