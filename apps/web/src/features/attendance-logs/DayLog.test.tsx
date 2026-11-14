// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../test/render'; // registers testing-library cleanup between tests
import { MemoryRouter } from 'react-router-dom';

const download = vi.hoisted(() => vi.fn());
vi.mock('./csv', async (importOriginal) => ({ ...(await importOriginal<typeof import('./csv')>()), downloadTextFile: download }));

import { DayLog } from './DayLog';
import { emptyDay, exampleDay, row, session } from './fixtures';

const view = (day = exampleDay()) => render(<MemoryRouter><DayLog day={day} /></MemoryRouter>);
/** The desktop table (jsdom shows both layouts, so scope to the table). */
const table = () => screen.getByRole('table');
const rowOf = (name: string) => within(table()).getByText(name).closest('tr')!;

beforeEach(() => download.mockReset());

describe('DayLog: the table', () => {
    it('has the four requested columns plus Status', () => {
        view();

        for (const h of ['Employee', 'Clock in', 'Clock out', 'Total hours', 'Status']) expect(within(table()).getByText(h)).toBeTruthy();
    });

    it('shows the date as a heading and a row per employee, in the company timezone', () => {
        view();

        expect(screen.getByRole('heading', { name: 'Wednesday, January 14, 2026' })).toBeTruthy();
        const alice = rowOf('Alice Tremblay');
        expect(within(alice).getByText(/8:55\s?AM/)).toBeTruthy(); // 13:55 UTC is 8:55 in Toronto
        expect(within(alice).getByText(/5:03\s?PM/)).toBeTruthy();
        expect(within(alice).getByText('8h 08m')).toBeTruthy();
        expect(within(alice).getByText('EMP-100001')).toBeTruthy();
        expect(within(alice).getByText('Complete')).toBeTruthy();
    });

    it('a person with two sessions is ONE row: first clock-in, last clock-out, and the summed total (8h 18m)', () => {
        view();
        const bob = rowOf('Bob Okafor');

        expect(within(bob).getByText(/7:58\s?AM/)).toBeTruthy();
        expect(within(bob).getByText(/5:01\s?PM/)).toBeTruthy();
        expect(within(bob).getByText('8h 18m')).toBeTruthy();
        expect(within(bob).queryByText('9h 03m')).toBeNull(); // not last-out minus first-in
        expect(within(bob).getByText('2 sessions · break 45m')).toBeTruthy();
    });

    it('opens and closes the sessions of a multi-session row, and single-session rows have no toggle', async () => {
        view();
        // The desktop table and the phone cards both render (and share state), so use the table's toggle.
        const toggle = (label: string) => within(table()).getByRole('button', { name: label });
        expect(within(table()).queryByText('Session 1')).toBeNull();
        expect(screen.queryByRole('button', { name: /sessions for Alice/ })).toBeNull();

        await userEvent.click(toggle('Show the 2 sessions for Bob Okafor'));

        expect(within(table()).getByText('Session 1')).toBeTruthy();
        expect(within(table()).getByText('Session 2')).toBeTruthy();
        expect(within(table()).getByText('4h 04m')).toBeTruthy();
        expect(within(table()).getByText('4h 14m')).toBeTruthy();
        expect(toggle('Hide the 2 sessions for Bob Okafor').getAttribute('aria-expanded')).toBe('true');

        await userEvent.click(toggle('Hide the 2 sessions for Bob Okafor'));
        expect(within(table()).queryByText('Session 1')).toBeNull();
    });

    it('"Expand all" opens every multi-session row and becomes "Collapse all"', async () => {
        view();

        await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
        expect(within(table()).getByText('Session 2')).toBeTruthy();

        await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
        expect(within(table()).queryByText('Session 2')).toBeNull();
    });

    it('no Expand all when nobody has more than one session', () => {
        view({ ...exampleDay(), rows: [row('Solo', 'EMP-9', [session('2026-01-14T14:00:00Z', '2026-01-14T22:00:00Z')])] });

        expect(screen.queryByRole('button', { name: /Expand all/ })).toBeNull();
    });
});

describe('DayLog: unusual cases', () => {
    it('someone still in: no clock-out, "In progress", and the badge', () => {
        view();
        const carol = rowOf('Carol Singh');

        expect(within(carol).getByText('—')).toBeTruthy();
        expect(within(carol).getByText('In progress')).toBeTruthy();
        expect(within(carol).getByText('● Still in')).toBeTruthy();
    });

    it('an overnight shift keeps its day and says "+1 day"', () => {
        view();
        const evan = rowOf('Evan Park');

        expect(within(evan).getByText('+1 day')).toBeTruthy();
        expect(within(evan).getByText('8h 05m')).toBeTruthy();
    });

    it('a forgotten check-out the system closed is shown with its hours HELD, not counted, and a link to review it', () => {
        view();
        const frank = rowOf('Frank Lee');

        expect(within(frank).getByText('Auto-closed · not paid until approved')).toBeTruthy();
        expect(within(frank).getByText(/\+ 16h 00m held/)).toBeTruthy();
        expect(within(frank).queryByText('16h 00m')).toBeNull(); // the main total is not 16 h
        expect(within(frank).getByRole('link', { name: 'Review' }).getAttribute('href')).toBe('/app/live-status');
    });

    it('a shift still open after 16 h is a forgotten check-out with a review link', () => {
        const day = { ...exampleDay(), rows: [row('Old Open', 'EMP-8', [session('2026-01-13T10:00:00Z', null, { state: 'OVERDUE' })], { status: 'OVERDUE' })] };
        view(day);

        expect(within(rowOf('Old Open')).getByText('Forgotten check-out')).toBeTruthy();
        expect(within(rowOf('Old Open')).getByText('Open')).toBeTruthy();
        expect(within(rowOf('Old Open')).getByRole('link', { name: 'Review' })).toBeTruthy();
    });

    it('a morning shift finished and an afternoon one still open: the total is the morning, with a note', () => {
        const day = { ...exampleDay(), rows: [row('Hal', 'EMP-7', [session('2026-01-14T13:00:00Z', '2026-01-14T17:00:00Z'), session('2026-01-14T17:45:00Z', null)], { status: 'IN_PROGRESS' })] };
        view(day);

        expect(within(rowOf('Hal')).getByText('4h 00m')).toBeTruthy();
        expect(within(rowOf('Hal')).getByText('more still open')).toBeTruthy();
    });
});

describe('DayLog: summary, empty day and export', () => {
    it('summarises the day on the same basis as payroll', () => {
        view();

        expect(screen.getByText('5')).toBeTruthy();
        expect(screen.getByText('24h 31m')).toBeTruthy();
        expect(screen.getByText(/still in/)).toBeTruthy();
        expect(screen.getByText(/awaiting approval/)).toBeTruthy();
        expect(screen.queryByText(/forgotten check-outs? still open/)).toBeNull(); // zero counts are not shown
    });

    it('a day nobody worked says so and disables the export', () => {
        view(emptyDay('2026-01-04'));

        expect(screen.getByText('No one clocked in on Sunday, January 4, 2026')).toBeTruthy();
        expect((screen.getByRole('button', { name: /Export CSV/ }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('Export CSV downloads attendance-<date>.csv with the day\'s rows, in the company timezone', async () => {
        view();

        await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));

        expect(download).toHaveBeenCalledTimes(1);
        const [name, text] = download.mock.calls[0] as [string, string];
        expect(name).toBe('attendance-2026-01-14.csv');
        expect(text).toContain('Alice Tremblay');
        expect(text).toMatch(/8:55\s?AM/);
        expect(text).toContain(',8.30,498,2,45,Complete');
    });
});

describe('DayLog: the phone layout', () => {
    it('lists each employee as a card with their times and total', () => {
        view();
        const cards = within(screen.getAllByRole('list')[0]!).getAllByRole('listitem');

        expect(cards).toHaveLength(5);
        expect(within(cards[1]!).getByText('Bob Okafor')).toBeTruthy();
        expect(within(cards[1]!).getByText('8h 18m')).toBeTruthy();
        expect(within(cards[1]!).getByText(/In 7:58\s?AM · Out 5:01\s?PM/)).toBeTruthy();
    });
});
