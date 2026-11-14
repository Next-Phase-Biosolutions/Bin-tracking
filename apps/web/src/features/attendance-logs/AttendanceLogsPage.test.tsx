// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { apiError } from '../../test/render';
import { renderWithTrpc } from '../../test/renderWithTrpc';
import { emptyDay, exampleDay, monthData } from './fixtures';

const subscription = vi.hoisted(() => ({ workforce: true }));
vi.mock('../../context/SubscriptionContext', () => ({
    useSubscription: () => ({ hasModule: () => subscription.workforce, isLoading: false }),
}));

import AttendanceLogsPage from './AttendanceLogsPage';

function Where() {
    const l = useLocation();
    return <output data-testid="where">{l.pathname + l.search}</output>;
}
const page = () => (
    <>
        <AttendanceLogsPage />
        <Where />
    </>
);
const where = () => screen.getByTestId('where').textContent;

const admin = { orgRole: 'ADMIN' };
const JAN = monthData(2026, 1, [['2026-01-06', 4], ['2026-01-14', 5], ['2026-01-15', 1]]);
const base = {
    'auth.me': () => admin,
    'attendance.logsMonth': (input: unknown) => {
        const { year, month } = input as { year: number; month: number };
        return year === 2026 && month === 1 ? JAN : monthData(year, month, []);
    },
    'attendance.logsDay': (input: unknown) => ((input as { date: string }).date === '2026-01-14' ? exampleDay() : emptyDay((input as { date: string }).date)),
};
const dayBtn = (name: RegExp) => screen.findByRole('button', { name });

beforeEach(() => {
    subscription.workforce = true;
});

describe('AttendanceLogsPage: month, then date, then the table', () => {
    it('opens on a month: the calendar shows who clocked in each day, and asks you to pick a date', async () => {
        const { callsTo } = renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=2026-01' });

        expect(await screen.findByRole('heading', { name: 'Attendance Logs' })).toBeTruthy();
        expect(await screen.findByText('5 in')).toBeTruthy();
        expect(screen.getByText('Select a date')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
        expect(callsTo('attendance.logsDay')).toHaveLength(0); // nothing is fetched until a date is chosen
        expect(callsTo('attendance.logsMonth')[0]!.input).toEqual({ year: 2026, month: 1 });
    });

    it('choosing a date loads that day and shows the log table, and puts the date in the URL', async () => {
        const { callsTo } = renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=2026-01' });

        await userEvent.click(await dayBtn(/^Wednesday, January 14, 2026/));

        expect(await screen.findByRole('heading', { name: 'Wednesday, January 14, 2026' })).toBeTruthy();
        const table = screen.getByRole('table');
        expect(within(table).getByText('Alice Tremblay')).toBeTruthy();
        expect(within(table).getByText('8h 18m')).toBeTruthy();
        expect(callsTo('attendance.logsDay')[0]!.input).toEqual({ date: '2026-01-14' });
        expect(where()).toBe('/app/attendance-logs?month=2026-01&date=2026-01-14');
        expect(screen.getByRole('button', { name: /^Wednesday, January 14/ }).getAttribute('aria-pressed')).toBe('true');
    });

    it('choosing another date replaces the table', async () => {
        renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=2026-01&date=2026-01-14' });
        await screen.findByRole('table');

        await userEvent.click(await dayBtn(/^Sunday, January 4, 2026/));

        expect(await screen.findByText('No one clocked in on Sunday, January 4, 2026')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('a link with a date opens straight onto that day, in the right month', async () => {
        const { callsTo } = renderWithTrpc(page(), base, { route: '/app/attendance-logs?date=2026-01-14' });

        expect(await screen.findByRole('table')).toBeTruthy();
        expect(callsTo('attendance.logsMonth')[0]!.input).toEqual({ year: 2026, month: 1 });
        expect(screen.getByRole('button', { name: 'January 2026' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('picking a different month clears the date and loads that month', async () => {
        const { callsTo } = renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=2026-01&date=2026-01-14' });
        await screen.findByRole('table');

        await userEvent.click(screen.getByRole('button', { name: 'February 2026' }));

        await waitFor(() => expect(where()).toBe('/app/attendance-logs?month=2026-02'));
        expect(await screen.findByText('Select a date')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
        expect(callsTo('attendance.logsMonth').some((c) => JSON.stringify(c.input) === JSON.stringify({ year: 2026, month: 2 }))).toBe(true);
    });

    it('months that have not started (by the COMPANY\'s today) cannot be chosen', async () => {
        renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=2026-01' });
        await screen.findByText('5 in');

        expect((screen.getByRole('button', { name: 'February 2026' }) as HTMLButtonElement).disabled).toBe(false); // today is 10 Feb
        expect((screen.getByRole('button', { name: 'March 2026' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('the year arrows keep the month, and never land on a month that has not started', async () => {
        renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=2025-06' });
        await screen.findByRole('group', { name: 'June 2025' });

        await userEvent.click(screen.getByRole('button', { name: 'Next year' }));
        await waitFor(() => expect(where()).toBe('/app/attendance-logs?month=2026-02')); // June 2026 hasn't started: clamped to the current month

        await userEvent.click(screen.getByRole('button', { name: 'Previous year' }));
        await waitFor(() => expect(where()).toBe('/app/attendance-logs?month=2025-02'));
        expect((screen.getByRole('button', { name: 'Next year' }) as HTMLButtonElement).disabled).toBe(false);
    });
});

describe('AttendanceLogsPage: layout guards (the table must never stretch the page)', () => {
    it('keeps the table column shrinkable and stacks the calendar above it until the screen is wide', async () => {
        renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=2026-01&date=2026-01-14' });
        await screen.findByRole('table');

        const column = screen.getByRole('table').closest('[aria-live="polite"]')!;
        expect(column.className).toContain('min-w-0');
        expect(column.parentElement!.className).toMatch(/xl:grid-cols-\[[^\]]*minmax\(0,1fr\)\]/);
        expect(screen.getByRole('table').className).toContain('table-fixed');
    });
});

describe('AttendanceLogsPage: bad input, loading and failures', () => {
    it('ignores a nonsense month or an impossible date in the URL and shows a normal month', async () => {
        const { callsTo } = renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=banana&date=2026-02-30' });

        expect(await screen.findByText('Select a date')).toBeTruthy();
        expect(callsTo('attendance.logsDay')).toHaveLength(0);
        expect(Number.isInteger((callsTo('attendance.logsMonth')[0]!.input as { year: number }).year)).toBe(true);
    });

    it('shows a loading state while the day loads', async () => {
        let release!: (v: unknown) => void;
        renderWithTrpc(page(), { ...base, 'attendance.logsDay': () => new Promise((resolve) => (release = resolve)) }, { route: '/app/attendance-logs?month=2026-01&date=2026-01-14' });

        expect(await screen.findByText(/Loading Wednesday, January 14, 2026/)).toBeTruthy();
        release(exampleDay());
        expect(await screen.findByRole('table')).toBeTruthy();
    });

    it('a failed day load says so and Try again reloads it', async () => {
        let n = 0;
        renderWithTrpc(page(), { ...base, 'attendance.logsDay': () => { if (++n === 1) throw apiError('X', 500); return exampleDay(); } }, { route: '/app/attendance-logs?month=2026-01&date=2026-01-14' });

        expect((await screen.findByRole('alert')).textContent).toContain('Could not load Wednesday, January 14, 2026');
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(await screen.findByRole('table')).toBeTruthy();
    });

    it('a failed month load says so, the page still works, and Try again reloads it', async () => {
        let n = 0;
        renderWithTrpc(page(), { ...base, 'attendance.logsMonth': () => { if (++n === 1) throw apiError('X', 500); return JAN; } }, { route: '/app/attendance-logs?month=2026-01' });

        expect((await screen.findByRole('alert')).textContent).toContain('Could not load this month');
        expect(screen.getAllByRole('button').some((b) => /^Wednesday, January 14, 2026/.test(b.getAttribute('aria-label') ?? ''))).toBe(true);
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(await screen.findByText('5 in')).toBeTruthy();
    });

    it('never shows another month\'s counts while a month is loading', async () => {
        let release!: (v: unknown) => void;
        renderWithTrpc(page(), { ...base, 'attendance.logsMonth': (input) => ((input as { month: number }).month === 1 ? JAN : new Promise((resolve) => (release = resolve))) }, { route: '/app/attendance-logs?month=2026-01' });
        await screen.findByText('5 in');

        await userEvent.click(screen.getByRole('button', { name: 'February 2026' }));

        await screen.findByRole('group', { name: 'February 2026' });
        expect(screen.queryByText('5 in')).toBeNull();
        release(monthData(2026, 2, [['2026-02-02', 3]]));
        expect(await screen.findByText('3 in')).toBeTruthy();
    });
});

describe('AttendanceLogsPage: who can open it', () => {
    it.each(['WORKER', 'DRIVER'])('a %s sees "available to admins and ops managers only" and nothing is fetched', async (orgRole) => {
        const { callsTo } = renderWithTrpc(page(), { ...base, 'auth.me': () => ({ orgRole }) }, { route: '/app/attendance-logs?month=2026-01&date=2026-01-14' });

        expect(await screen.findByText(/available to admins and ops managers only/)).toBeTruthy();
        expect(callsTo('attendance.logsMonth')).toHaveLength(0);
        expect(callsTo('attendance.logsDay')).toHaveLength(0);
    });

    it('an ops manager can open it', async () => {
        renderWithTrpc(page(), { ...base, 'auth.me': () => ({ orgRole: 'OPS_MANAGER' }) }, { route: '/app/attendance-logs?month=2026-01' });

        expect(await screen.findByRole('heading', { name: 'Attendance Logs' })).toBeTruthy();
    });

    it('an organization without the Workforce module sees the upgrade prompt, not the page', async () => {
        subscription.workforce = false;
        const { callsTo } = renderWithTrpc(page(), base, { route: '/app/attendance-logs?month=2026-01' });

        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Attendance Logs' })).toBeNull());
        expect(callsTo('attendance.logsMonth')).toHaveLength(0);
    });
});
