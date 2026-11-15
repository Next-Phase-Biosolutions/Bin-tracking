// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../test/render'; // registers testing-library cleanup between tests
import { MonthBar } from './MonthBar';

const props = { year: 2026, month: 1, today: '2026-02-10', onYear: vi.fn(), onMonth: vi.fn() };
const pill = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('MonthBar', () => {
    it('shows the year and all twelve months, with the chosen month marked', () => {
        render(<MonthBar {...props} />);

        expect(screen.getByText('2026')).toBeTruthy();
        expect(screen.getAllByRole('button').filter((b) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(b.textContent ?? ''))).toHaveLength(12);
        expect(pill('January 2026').getAttribute('aria-pressed')).toBe('true');
        expect(pill('February 2026').getAttribute('aria-pressed')).toBe('false');
    });

    it('disables months that have not started, but not the current month or earlier ones', () => {
        render(<MonthBar {...props} />);

        expect(pill('January 2026').disabled).toBe(false);
        expect(pill('February 2026').disabled).toBe(false); // the current month
        expect(pill('March 2026').disabled).toBe(true);
        expect(pill('December 2026').disabled).toBe(true);
    });

    it('a past year has every month enabled', () => {
        render(<MonthBar {...props} year={2025} />);

        expect(screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed')).every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    });

    it('calls back with the month number when a month is clicked, and not for a disabled one', async () => {
        const onMonth = vi.fn();
        render(<MonthBar {...props} onMonth={onMonth} />);

        await userEvent.click(pill('February 2026'));
        await userEvent.click(pill('March 2026'));

        expect(onMonth).toHaveBeenCalledTimes(1);
        expect(onMonth).toHaveBeenCalledWith(2);
    });

    it('the year arrows move by one year; Next is disabled in the current year, Previous at the first browsable year', async () => {
        const onYear = vi.fn();
        const { rerender } = render(<MonthBar {...props} onYear={onYear} />);

        expect(pill('Next year').disabled).toBe(true);
        await userEvent.click(pill('Previous year'));
        expect(onYear).toHaveBeenCalledWith(-1);

        rerender(<MonthBar {...props} year={2025} onYear={onYear} />);
        await userEvent.click(pill('Next year'));
        expect(onYear).toHaveBeenLastCalledWith(1);

        rerender(<MonthBar {...props} year={2020} onYear={onYear} />);
        expect(pill('Previous year').disabled).toBe(true);
    });
});
