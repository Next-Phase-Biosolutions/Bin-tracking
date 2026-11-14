// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../test/render'; // registers testing-library cleanup between tests
import { CalendarGrid } from './CalendarGrid';

const counts = new Map([['2026-01-06', 4], ['2026-01-14', 5], ['2026-01-15', 1]]);
const base = { year: 2026, month: 1, counts, today: '2026-02-10', selected: null as string | null, onSelect: vi.fn() };
const dayButtons = () => screen.getAllByRole('button');

describe('CalendarGrid', () => {
    it('lays out January 2026 with its weekday headers and 31 selectable days', () => {
        render(<CalendarGrid {...base} />);

        for (const d of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) expect(screen.getByText(d)).toBeTruthy();
        expect(dayButtons()).toHaveLength(31);
        expect(screen.getByRole('button', { name: /^Thursday, January 1, 2026/ })).toBeTruthy();
    });

    it('shows "N in" only on days where someone clocked in', () => {
        render(<CalendarGrid {...base} />);

        expect(screen.getByText('5 in')).toBeTruthy();
        expect(screen.getByText('4 in')).toBeTruthy();
        expect(screen.getByText('1 in')).toBeTruthy();
        expect(screen.getAllByText(/ in$/)).toHaveLength(3);
    });

    it('describes each day for a screen reader, including the count', () => {
        render(<CalendarGrid {...base} />);

        expect(screen.getByRole('button', { name: 'Wednesday, January 14, 2026, 5 employees clocked in' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Thursday, January 15, 2026, 1 employee clocked in' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Friday, January 16, 2026, no one clocked in' })).toBeTruthy();
    });

    it('selects a day with a click and reports the date', async () => {
        const onSelect = vi.fn();
        render(<CalendarGrid {...base} onSelect={onSelect} />);

        await userEvent.click(screen.getByRole('button', { name: /^Wednesday, January 14, 2026/ }));

        expect(onSelect).toHaveBeenCalledWith('2026-01-14');
    });

    it('works with the keyboard (Enter on a focused day)', async () => {
        const onSelect = vi.fn();
        render(<CalendarGrid {...base} onSelect={onSelect} />);
        screen.getByRole('button', { name: /^Tuesday, January 6, 2026/ }).focus();

        await userEvent.keyboard('{Enter}');

        expect(onSelect).toHaveBeenCalledWith('2026-01-06');
    });

    it('marks the chosen day as pressed', () => {
        render(<CalendarGrid {...base} selected="2026-01-14" />);

        expect(screen.getByRole('button', { name: /^Wednesday, January 14/ }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', { name: /^Thursday, January 15/ }).getAttribute('aria-pressed')).toBe('false');
    });

    it('disables days after today and refuses a click on them', async () => {
        const onSelect = vi.fn();
        render(<CalendarGrid {...base} year={2026} month={2} counts={new Map()} onSelect={onSelect} />);

        const future = screen.getByRole('button', { name: /^Wednesday, February 11, 2026, in the future/ }) as HTMLButtonElement;
        await userEvent.click(future);

        expect(future.disabled).toBe(true);
        expect((screen.getByRole('button', { name: /^Tuesday, February 10, 2026/ }) as HTMLButtonElement).disabled).toBe(false); // today itself is allowed
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('marks today', () => {
        render(<CalendarGrid {...base} year={2026} month={2} counts={new Map()} />);

        expect(screen.getByRole('button', { name: /^Tuesday, February 10/ }).getAttribute('aria-current')).toBe('date');
    });

    it('a 28-day February has 28 days and a leap February has 29', () => {
        const { unmount } = render(<CalendarGrid {...base} year={2026} month={2} counts={new Map()} today="2030-01-01" />);
        expect(dayButtons()).toHaveLength(28);
        unmount();
        render(<CalendarGrid {...base} year={2028} month={2} counts={new Map()} today="2030-01-01" />);
        expect(dayButtons()).toHaveLength(29);
    });
});
