export type Plan = 'STARTER' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

/**
 * One module per optional feature area. CORE_TRACKING (bin/cycle/facility/
 * dashboard) is deliberately absent — it's not gateable, every org has it.
 */
export type ModuleKey =
    | 'ANIMAL_INTAKE'      // farmer/voice registration — farmer.router
    | 'WORKFORCE'          // employee register + timesheet + guard scanner — employee/attendance routers
    | 'SHIPMENTS'          // register + record shipments — shipment.router
    | 'FORMS'              // create + fill forms — form.router, excluding AI digitize
    | 'FORMS_AI_DIGITIZE'  // Gemini photo-to-form digitization — metered, Task 15
    | 'BLOCKCHAIN_ANCHOR'  // Cardano CIP-25 anchoring — blockchain.router
    | 'PAYROLL';           // requires WORKFORCE — payroll.router

/** Every gateable module key, in display order — used by the platform-admin panel (Task 16) to render one checkbox column per module. */
export const ALL_MODULE_KEYS: ModuleKey[] = [
    'ANIMAL_INTAKE',
    'WORKFORCE',
    'SHIPMENTS',
    'FORMS',
    'FORMS_AI_DIGITIZE',
    'BLOCKCHAIN_ANCHOR',
    'PAYROLL',
];

export interface PlanLimits {
    maxFacilities: number;    // -1 = unlimited
    maxEmployees: number;
    monthlyDigitize: number;  // -1 = unlimited, 0 = not available on this plan
    monthlyTranscribe: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
    STARTER:    { maxFacilities: 1,  maxEmployees: 25,  monthlyDigitize: 0,  monthlyTranscribe: 0 },
    PRO:        { maxFacilities: 5,  maxEmployees: 200, monthlyDigitize: 20, monthlyTranscribe: 50 },
    ENTERPRISE: { maxFacilities: -1, maxEmployees: -1,  monthlyDigitize: -1, monthlyTranscribe: -1 },
};

/** Default module bundle granted when an org signs up for or upgrades to a plan. */
export const PLAN_DEFAULT_MODULES: Record<Plan, ModuleKey[]> = {
    STARTER:    ['WORKFORCE', 'SHIPMENTS'],
    PRO:        ['ANIMAL_INTAKE', 'WORKFORCE', 'SHIPMENTS', 'FORMS', 'BLOCKCHAIN_ANCHOR', 'PAYROLL'],
    ENTERPRISE: ['ANIMAL_INTAKE', 'WORKFORCE', 'SHIPMENTS', 'FORMS', 'FORMS_AI_DIGITIZE', 'BLOCKCHAIN_ANCHOR', 'PAYROLL'],
};

const USABLE_STATUSES: readonly SubscriptionStatus[] = ['TRIALING', 'ACTIVE'];

/** What a FRESH signup/upgrade should default to. NOT the enforcement source of truth — see Task 12/14's OrganizationModule table for that. */
export function defaultModulesForPlan(plan: Plan): ModuleKey[] {
    return PLAN_DEFAULT_MODULES[plan];
}

export function isSubscriptionUsable(status: SubscriptionStatus): boolean {
    return USABLE_STATUSES.includes(status);
}
