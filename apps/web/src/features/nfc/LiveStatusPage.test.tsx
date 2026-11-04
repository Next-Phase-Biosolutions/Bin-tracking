// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError } from '../../test/render';
import { renderWithTrpc } from '../../test/renderWithTrpc';

vi.mock('../../context/SubscriptionContext', () => ({
    useSubscription: () => ({ hasModule: () => true, isLoading: false }),
}));

import LiveStatusPage from './LiveStatusPage';

const asOf = new Date('2031-03-03T17:00:00');
const person = (n: number, over: object = {}) => ({ employeeId: `e${n}`, fullName: `Person ${n}`, employeeCode: `EMP-00000${n}`, ...over });

function status(over: Partial<{ checkedIn: object[]; overdue: object[]; checkedOut: object[]; totals: object }> = {}) {
    const checkedIn = over.checkedIn ?? [person(1, { since: new Date('2031-03-03T09:00:00') })];
    const overdue = over.overdue ?? [];
    const checkedOut = over.checkedOut ?? [person(2, { lastCheckOutAt: new Date('2031-03-03T08:00:00') })];
    return {
        asOf,
        totals: { employees: 2, active: 2, inactive: 0, checkedIn: checkedIn.length, overdue: overdue.length, checkedOut: checkedOut.length, unregistered: 0, ...over.totals },
        checkedIn, overdue, checkedOut,
    };
}

const admin = { 'auth.me': () => ({ orgRole: 'OPS_MANAGER' }), 'attendance.listPendingApprovals': () => [] };

describe('LiveStatusPage', () => {
    it('lists who is in and who is out, with time since check-in measured from the SERVER clock', async () => {
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, { ...admin, 'attendance.facilityStatus': () => status() });

        expect(await screen.findByText('Person 1')).toBeTruthy();
        expect(screen.getByText('Person 2')).toBeTruthy();
        expect(screen.getByText(/· 8h/)).toBeTruthy(); // 09:00 -> asOf 17:00, not the browser's clock
        expect(screen.getByText(/last out/)).toBeTruthy();
    });

    it('shows the empty states', async () => {
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, {
            ...admin, 'attendance.facilityStatus': () => status({ checkedIn: [], checkedOut: [], totals: { employees: 0, active: 0 } }),
        });

        expect(await screen.findByText('Nobody is checked in.')).toBeTruthy();
        expect(screen.getByText('Everyone is checked in.')).toBeTruthy();
    });

    it('shows "never checked out" for someone with no completed shift', async () => {
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, {
            ...admin, 'attendance.facilityStatus': () => status({ checkedOut: [person(3, { lastCheckOutAt: null })] }),
        });
        expect(await screen.findByText('never checked out')).toBeTruthy();
    });

    it('raises a "needs attention" block only when someone has been in 16 h or more', async () => {
        const first = renderWithTrpc(<LiveStatusPage pollMs={60_000} />, { ...admin, 'attendance.facilityStatus': () => status() });
        await screen.findByText('Person 1');
        expect(screen.queryByText('needs_attention')).toBeNull();
        first.unmount();

        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, {
            ...admin, 'attendance.facilityStatus': () => status({ overdue: [person(4, { since: new Date('2031-03-02T10:00:00') })] }),
        });
        expect(await screen.findByText('needs_attention')).toBeTruthy();
        expect(screen.getByText(/forgotten check-out/)).toBeTruthy();
        expect(screen.getByText('Person 4')).toBeTruthy();
    });

    it('tells the manager how many active employees cannot tap in yet', async () => {
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, {
            ...admin, 'attendance.facilityStatus': () => status({ totals: { unregistered: 3 } }),
        });
        expect((await screen.findByText(/no registered phone yet/)).textContent).toContain('3 active employees have no registered phone');
    });

    it('polls: the status is fetched again after the interval', async () => {
        const { callsTo } = renderWithTrpc(<LiveStatusPage pollMs={40} />, { ...admin, 'attendance.facilityStatus': () => status() });
        await screen.findByText('Person 1');

        await waitFor(() => expect(callsTo('attendance.facilityStatus').length).toBeGreaterThanOrEqual(3));
    });

    it('keeps the last known status and says the connection was lost when a refresh fails', async () => {
        renderWithTrpc(<LiveStatusPage pollMs={40} />, {
            ...admin,
            'attendance.facilityStatus': (_input, n) => { if (n > 1) throw new Error('network down'); return status(); },
        });

        expect((await screen.findByText(/Connection lost/)).textContent).toContain('last known status');
        expect(screen.getByText('Person 1')).toBeTruthy();
    });

    it('explains a first-load failure instead of showing an empty floor', async () => {
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, { ...admin, 'attendance.facilityStatus': () => { throw new Error('down'); } });
        expect((await screen.findByRole('alert')).textContent).toContain('Could not load the live status');
    });

    it('is closed to a worker and never asks for the floor status', async () => {
        const { callsTo } = renderWithTrpc(<LiveStatusPage pollMs={60_000} />, {
            'auth.me': () => ({ orgRole: 'WORKER' }), 'attendance.facilityStatus': () => status(),
        });

        expect(await screen.findByText(/available to admins and ops managers only/)).toBeTruthy();
        expect(callsTo('attendance.facilityStatus')).toHaveLength(0);
    });
});

describe('Forgotten check-outs (approvals)', () => {
    const pendingRow = (over: object = {}) => ({
        id: 'sess-1', checkInAt: new Date('2031-03-02T08:00:00'), checkOutAt: new Date('2031-03-03T00:00:00'), durationMin: 960,
        employee: { id: 'e9', fullName: 'Forgetful Fred', employeeCode: 'EMP-000009' }, ...over,
    });
    const base = { 'auth.me': () => ({ orgRole: 'ADMIN' }), 'attendance.facilityStatus': () => status() };

    it('is hidden when nothing is waiting', async () => {
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, { ...base, 'attendance.listPendingApprovals': () => [] });
        await screen.findByText('Person 1');
        expect(screen.queryByText(/Forgotten check-outs/)).toBeNull();
    });

    it('lists each auto-closed shift with how long it was capped at', async () => {
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, { ...base, 'attendance.listPendingApprovals': () => [pendingRow()] });

        expect(await screen.findByText('Forgetful Fred')).toBeTruthy();
        expect(screen.getByText(/closed at 16h/)).toBeTruthy();
        expect(screen.getByText(/not paid until you approve/)).toBeTruthy();
    });

    it('approves as-is: sends only the id, tells the manager to re-run payroll, and refreshes both lists', async () => {
        const user = userEvent.setup();
        let pending = [pendingRow()];
        const { callsTo } = renderWithTrpc(<LiveStatusPage pollMs={60_000} />, {
            ...base,
            'attendance.listPendingApprovals': () => pending,
            'attendance.approveWorkSession': () => { pending = []; return { id: 'sess-1' }; },
        });
        await screen.findByText('Forgetful Fred');

        await user.click(screen.getByRole('button', { name: 'Approve Forgetful Fred as-is' }));

        expect((await screen.findByRole('status')).textContent).toContain('Re-run payroll');
        expect(callsTo('attendance.approveWorkSession')[0]!.input).toEqual({ id: 'sess-1', checkOutAt: undefined });
        await waitFor(() => expect(screen.queryByText('Forgetful Fred')).toBeNull());
        expect(callsTo('attendance.facilityStatus').length).toBeGreaterThanOrEqual(2);
    });

    it('approves with a real check-out time, sent as an ISO instant', async () => {
        const user = userEvent.setup();
        const { callsTo } = renderWithTrpc(<LiveStatusPage pollMs={60_000} />, {
            ...base, 'attendance.listPendingApprovals': () => [pendingRow()], 'attendance.approveWorkSession': () => ({ id: 'sess-1' }),
        });
        await screen.findByText('Forgetful Fred');

        await user.click(screen.getByRole('button', { name: 'Enter a real check-out time for Forgetful Fred' }));
        const input = screen.getByLabelText('Real check-out time for Forgetful Fred');
        await user.type(input, '2031-03-03T03:30');
        await user.click(screen.getByRole('button', { name: 'Approve with this time' }));

        await waitFor(() => expect(callsTo('attendance.approveWorkSession')).toHaveLength(1));
        const sent = (callsTo('attendance.approveWorkSession')[0]!.input as { checkOutAt: string }).checkOutAt;
        expect(sent).toBe(new Date('2031-03-03T03:30').toISOString());
    });

    it('will not submit the custom-time form without a time', async () => {
        const user = userEvent.setup();
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, { ...base, 'attendance.listPendingApprovals': () => [pendingRow()] });
        await screen.findByText('Forgetful Fred');

        await user.click(screen.getByRole('button', { name: 'Enter a real check-out time for Forgetful Fred' }));

        expect((screen.getByRole('button', { name: 'Approve with this time' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it.each([
        ['OVERLAPS_NEXT_SESSION', 400, 'next shift'],
        ['INVALID_CHECK_OUT', 400, 'after check-in'],
        ['ALREADY_APPROVED', 409, 'already approved'],
    ])('explains %s without losing the row', async (appCode, status, phrase) => {
        const user = userEvent.setup();
        renderWithTrpc(<LiveStatusPage pollMs={60_000} />, {
            ...base, 'attendance.listPendingApprovals': () => [pendingRow()], 'attendance.approveWorkSession': () => { throw apiError(appCode, status); },
        });
        await screen.findByText('Forgetful Fred');

        await user.click(screen.getByRole('button', { name: 'Approve Forgetful Fred as-is' }));

        const alert = await screen.findByRole('alert');
        expect(within(alert).getByText(new RegExp(phrase, 'i'))).toBeTruthy();
        expect(screen.getByText('Forgetful Fred')).toBeTruthy();
    });
});
