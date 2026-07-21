import type { ModuleKey } from '@bin-tracker/types';

/** Navigation config: sidebar nav items. */

export interface NavItem {
    label: string;
    href: string;
    icon: string;
    /** When set, the link only renders if the org's subscription has this module enabled — mirrors the gating the dashboard's old inline sidebar enforced. */
    module?: ModuleKey;
}

/** OPERATIONS — people, logistics, records, compliance. Main Dashboard/Driver/Bin are core tracking, never gated. */
export const operationsNav: NavItem[] = [
    { label: 'Main Dashboard', href: '/app/dashboard', icon: 'grid' },
    { label: 'Driver Portal', href: '/app/driver', icon: 'truck' },
    { label: 'Bin Scanner', href: '/app/bin', icon: 'scan' },
    { label: 'Shipments', href: '/app/shipments', icon: 'box', module: 'SHIPMENTS' },
    { label: 'Animal Registration', href: '/app/animalregistration', icon: 'cow', module: 'ANIMAL_INTAKE' },
    { label: 'Animal Records', href: '/app/animals', icon: 'form', module: 'ANIMAL_INTAKE' },
    { label: 'Employees', href: '/app/employees', icon: 'users', module: 'WORKFORCE' },
    { label: 'Employee Registration', href: '/app/employees/register', icon: 'badge', module: 'WORKFORCE' },
    { label: 'Employee Scanner', href: '/app/guard', icon: 'badge', module: 'WORKFORCE' },
    { label: 'Timesheet', href: '/app/timesheet', icon: 'clock', module: 'WORKFORCE' },
    { label: 'Forms', href: '/app/forms', icon: 'form', module: 'FORMS' },
    { label: 'Create a Form', href: '/app/forms/import', icon: 'form', module: 'FORMS_AI_DIGITIZE' },
];
