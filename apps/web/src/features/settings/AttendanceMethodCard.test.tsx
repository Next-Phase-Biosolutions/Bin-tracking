// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError } from '../../test/render';
import { renderWithTrpc } from '../../test/renderWithTrpc';
import { AttendanceMethodCard } from './AttendanceMethodCard';

describe('AttendanceMethodCard', () => {
    it('shows which method is active and selects it', async () => {
        renderWithTrpc(<AttendanceMethodCard />, { 'attendance.method': () => ({ method: 'NFC' }) });

        expect(await screen.findByText('NFC active')).toBeTruthy();
        expect((screen.getByRole('radio', { name: /NFC tags/ }) as HTMLInputElement).checked).toBe(true);
        expect((screen.getByRole('radio', { name: /QR badge scanner/ }) as HTMLInputElement).checked).toBe(false);
    });

    it('switches to QR, sends exactly that value, and shows the new state from a fresh read', async () => {
        let method: 'NFC' | 'QR' = 'NFC';
        const { callsTo } = renderWithTrpc(<AttendanceMethodCard />, {
            'attendance.method': () => ({ method }),
            'settings.get': () => ({}),
            'settings.setAttendanceMethod': (input) => {
                method = (input as { method: 'NFC' | 'QR' }).method;
                return { attendanceMethod: method };
            },
        });
        await screen.findByText('NFC active');

        await userEvent.click(screen.getByRole('radio', { name: /QR badge scanner/ }));

        expect(await screen.findByText('QR active')).toBeTruthy();
        expect(callsTo('settings.setAttendanceMethod')[0]!.input).toEqual({ method: 'QR' });
    });

    it('shows the reason when the change is refused', async () => {
        renderWithTrpc(<AttendanceMethodCard />, {
            'attendance.method': () => ({ method: 'NFC' }),
            'settings.setAttendanceMethod': () => {
                throw apiError('FORBIDDEN', 403);
            },
        });
        await screen.findByText('NFC active');

        await userEvent.click(screen.getByRole('radio', { name: /QR badge scanner/ }));

        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
        expect(screen.getByText('NFC active')).toBeTruthy(); // unchanged
    });

    it('warns that switching affects everyone at once', async () => {
        renderWithTrpc(<AttendanceMethodCard />, { 'attendance.method': () => ({ method: 'NFC' }) });

        expect(await screen.findByText(/takes effect immediately for everyone/i)).toBeTruthy();
    });
});
