// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithTrpc } from '../../test/renderWithTrpc';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'a@example.test' }, logout: () => undefined }) }));
vi.mock('../../context/SubscriptionContext', () => ({
    useSubscription: () => ({ hasModule: () => true, modulesReady: true, isLoading: false }),
}));

import { Sidebar } from './Sidebar';

const base = {
    'auth.me': () => ({ orgRole: 'ADMIN', name: 'Admin', id: 'u1' }),
    'admin.whoAmI': () => ({ isPlatformAdmin: false }),
    'auth.myOrgs': () => [],
    'zone.listMine': () => [],
};

describe('Sidebar: only the active clock-in method is shown', () => {
    it('NFC: shows NFC Cards and hides the QR Employee Scanner', async () => {
        renderWithTrpc(<Sidebar />, { ...base, 'attendance.method': () => ({ method: 'NFC' }) });

        expect(await screen.findByText('NFC Cards')).toBeTruthy();
        expect(screen.queryByText('Employee Scanner')).toBeNull();
        expect(screen.getByText('Live Status')).toBeTruthy(); // method-independent
        expect(screen.getByText('Timesheet')).toBeTruthy();
    });

    it('QR: shows the Employee Scanner and hides NFC Cards', async () => {
        renderWithTrpc(<Sidebar />, { ...base, 'attendance.method': () => ({ method: 'QR' }) });

        expect(await screen.findByText('Employee Scanner')).toBeTruthy();
        expect(screen.queryByText('NFC Cards')).toBeNull();
        expect(screen.getByText('Live Status')).toBeTruthy();
    });

    it('hides both method-specific links until the method is known (no flash of the wrong one)', async () => {
        renderWithTrpc(<Sidebar />, { ...base, 'attendance.method': () => new Promise(() => undefined) });

        expect(await screen.findByText('Timesheet')).toBeTruthy();
        expect(screen.queryByText('Employee Scanner')).toBeNull();
        expect(screen.queryByText('NFC Cards')).toBeNull();
    });
});

describe('Sidebar: Attendance Logs', () => {
    const items = () => [...document.querySelectorAll('nav a')].map((a) => a.textContent?.trim());

    it('is listed directly under Timesheet for an admin', async () => {
        renderWithTrpc(<Sidebar />, { ...base, 'attendance.method': () => ({ method: 'NFC' }) });

        expect(await screen.findByText('Attendance Logs')).toBeTruthy();
        const list = items();
        expect(list.indexOf('Attendance Logs')).toBe(list.indexOf('Timesheet') + 1);
        expect(document.querySelector('a[href="/app/attendance-logs"]')).not.toBeNull();
    });

    it('is listed for an ops manager', async () => {
        renderWithTrpc(<Sidebar />, { ...base, 'auth.me': () => ({ orgRole: 'OPS_MANAGER', name: 'Ops', id: 'u2' }), 'attendance.method': () => ({ method: 'NFC' }) });

        expect(await screen.findByText('Attendance Logs')).toBeTruthy();
    });

    it.each(['DRIVER', 'WORKER'])('is hidden from a %s, who still sees Timesheet', async (orgRole) => {
        renderWithTrpc(<Sidebar />, { ...base, 'auth.me': () => ({ orgRole, name: 'X', id: 'u3' }), 'attendance.method': () => ({ method: 'NFC' }) });

        expect(await screen.findByText('Timesheet')).toBeTruthy();
        expect(screen.queryByText('Attendance Logs')).toBeNull();
    });

    it('shows for both clock-in methods (it reads the same history either way)', async () => {
        renderWithTrpc(<Sidebar />, { ...base, 'attendance.method': () => ({ method: 'QR' }) });

        expect(await screen.findByText('Attendance Logs')).toBeTruthy();
    });
});
