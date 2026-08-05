import type { ModuleKey } from '@bin-tracker/types';

/** Navigation config: sidebar nav items. */

export interface NavItem {
    label: string;
    href: string;
    icon: string;
    /** When set, the link only renders if the org's subscription has this module enabled — mirrors the gating the dashboard's old inline sidebar enforced. */
    module?: ModuleKey;
    /** When set, the link only renders for these org roles (ctx.orgRole). Omit for no restriction. */
    roles?: Array<'ADMIN' | 'OPS_MANAGER' | 'DRIVER' | 'WORKER'>;
}

/** OPERATIONS — people, logistics, records, compliance. Main Dashboard/Driver/Bin are core tracking, never gated. */
export const operationsNav: NavItem[] = [
    { label: 'Main Dashboard', href: '/app/dashboard', icon: 'grid' },
    { label: 'Driver Portal', href: '/app/driver', icon: 'truck' },
    { label: 'Bin Scanner', href: '/app/bin', icon: 'scan' },
    { label: 'Shipments', href: '/app/shipments', icon: 'box', module: 'SHIPMENTS' },
    { label: 'Animal Registration', href: '/app/animalregistration', icon: 'cow', module: 'ANIMAL_INTAKE' },
    { label: 'Animal Records', href: '/app/animals', icon: 'form', module: 'ANIMAL_INTAKE' },
    { label: 'Employees', href: '/app/employees', icon: 'users', module: 'WORKFORCE', roles: ['ADMIN', 'OPS_MANAGER'] },
    { label: 'Employee Registration', href: '/app/employees/register', icon: 'badge', module: 'WORKFORCE', roles: ['ADMIN', 'OPS_MANAGER'] },
    { label: 'Employee Scanner', href: '/app/guard', icon: 'badge', module: 'WORKFORCE' },
    { label: 'Timesheet', href: '/app/timesheet', icon: 'clock', module: 'WORKFORCE' },
    { label: 'Payroll', href: '/app/payroll', icon: 'clock', module: 'PAYROLL' },
    { label: 'Forms', href: '/app/forms', icon: 'form', module: 'FORMS' },
];

/** FACILITY ZONES — the floor view. Presentation-only (mock data), same as the original design mockup — no module gating. */
export const facilityZonesNav: NavItem[] = [
    { label: 'Receiving', href: '/app/zones/receiving', icon: 'truck' },
    { label: 'Kill Floor', href: '/app/zones/killfloor', icon: 'blade' },
    { label: 'Processing', href: '/app/zones/processing', icon: 'knife' },
    { label: 'Wet Aging', href: '/app/zones/wetaging', icon: 'snow' },
    { label: 'Value Add', href: '/app/zones/valueadd', icon: 'box' },
    { label: 'Shipping', href: '/app/zones/shipping', icon: 'ship' },
];
