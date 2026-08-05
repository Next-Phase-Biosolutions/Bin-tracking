import { describe, it, expect } from 'vitest';
import { ALL_MODULE_KEYS, MODULE_LABELS, PLAN_DEFAULT_MODULES, PLAN_LIMITS, defaultModulesForPlan, isSubscriptionUsable } from '@bin-tracker/types';

describe('entitlements', () => {
    it('STARTER does not default-include blockchain or payroll', () => {
        expect(defaultModulesForPlan('STARTER')).not.toContain('BLOCKCHAIN_ANCHOR');
        expect(defaultModulesForPlan('STARTER')).not.toContain('PAYROLL');
    });
    it('PRO default-includes payroll and blockchain but not AI digitize', () => {
        const modules = defaultModulesForPlan('PRO');
        expect(modules).toContain('PAYROLL');
        expect(modules).toContain('BLOCKCHAIN_ANCHOR');
        expect(modules).not.toContain('FORMS_AI_DIGITIZE');
    });
    it('ENTERPRISE includes every module', () => {
        expect(defaultModulesForPlan('ENTERPRISE')).toContain('FORMS_AI_DIGITIZE');
    });
    it('TRIALING and ACTIVE are usable statuses; PAST_DUE and CANCELED are not', () => {
        expect(isSubscriptionUsable('TRIALING')).toBe(true);
        expect(isSubscriptionUsable('ACTIVE')).toBe(true);
        expect(isSubscriptionUsable('PAST_DUE')).toBe(false);
        expect(isSubscriptionUsable('CANCELED')).toBe(false);
    });
    it('every plan defines every limit key', () => {
        const keys = Object.keys(PLAN_LIMITS.STARTER);
        expect(Object.keys(PLAN_LIMITS.PRO)).toEqual(keys);
        expect(Object.keys(PLAN_LIMITS.ENTERPRISE)).toEqual(keys);
    });
    it('every plan default-includes ENVIRONMENT_MONITORING', () => {
        expect(defaultModulesForPlan('STARTER')).toContain('ENVIRONMENT_MONITORING');
        expect(defaultModulesForPlan('PRO')).toContain('ENVIRONMENT_MONITORING');
        expect(defaultModulesForPlan('ENTERPRISE')).toContain('ENVIRONMENT_MONITORING');
    });
    it('ENVIRONMENT_MONITORING is in ALL_MODULE_KEYS with a matching label', () => {
        expect(ALL_MODULE_KEYS).toContain('ENVIRONMENT_MONITORING');
        expect(MODULE_LABELS.ENVIRONMENT_MONITORING).toBe('Environment');
    });
});
