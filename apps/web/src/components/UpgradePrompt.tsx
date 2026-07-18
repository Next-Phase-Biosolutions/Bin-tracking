import { useState } from 'react';
import { MODULE_LABELS } from '@bin-tracker/types';
import type { ModuleKey, Plan } from '@bin-tracker/types';
import { trpc } from '../lib/trpc';
import { useSubscription } from '../context/SubscriptionContext';

const UPGRADE_PLANS: Plan[] = ['STARTER', 'PRO', 'ENTERPRISE'];

interface UpgradePromptProps {
    module: ModuleKey;
}

/**
 * Rendered in place of a page/section gated behind a module the org doesn't
 * currently have. Module assignment itself is always sales-assisted (Task
 * 16's admin-only per-org toggle) — there is no self-serve way to turn a
 * module on, so that copy never changes. The only thing that varies is
 * whether a self-serve *plan* upgrade path exists underneath it: only once
 * Stripe billing is actually turned on (`billingEnabled`). Never render both
 * the checkout buttons and the "free during early access" badge at once.
 */
export function UpgradePrompt({ module }: UpgradePromptProps) {
    const { billingEnabled } = useSubscription();
    const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);

    const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
        onSuccess: (result) => {
            window.location.href = result.url;
        },
        onSettled: () => setPendingPlan(null),
    });

    const handleUpgrade = (plan: Plan) => {
        setPendingPlan(plan);
        checkoutMutation.mutate({ plan });
    };

    return (
        <div className="mx-auto max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">{MODULE_LABELS[module]} isn&apos;t enabled yet</h2>
            <p className="mt-2 text-sm text-gray-600">Ask your account manager to enable this for your organization.</p>

            {billingEnabled ? (
                <div className="mt-6">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Or upgrade your plan</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {UPGRADE_PLANS.map((plan) => (
                            <button
                                key={plan}
                                type="button"
                                onClick={() => handleUpgrade(plan)}
                                disabled={checkoutMutation.isPending}
                                className="rounded-lg bg-[#3d5aa8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2d4898] disabled:opacity-50"
                            >
                                {pendingPlan === plan && checkoutMutation.isPending ? 'Redirecting…' : plan}
                            </button>
                        ))}
                    </div>
                    {checkoutMutation.isError && <p className="mt-2 text-xs text-red-600">{checkoutMutation.error.message}</p>}
                </div>
            ) : (
                <span className="mt-6 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Free during early access
                </span>
            )}
        </div>
    );
}

export default UpgradePrompt;
