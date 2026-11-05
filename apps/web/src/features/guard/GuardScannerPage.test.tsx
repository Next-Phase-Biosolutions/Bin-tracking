// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithTrpc } from '../../test/renderWithTrpc';

vi.mock('../../context/SubscriptionContext', () => ({
    useSubscription: () => ({ hasModule: () => true, isLoading: false }),
}));
// The camera needs a real device; the handheld input is all these tests use.
vi.mock('../../components/app/CameraScanner', () => ({ CameraScanner: () => null }));

import GuardScannerPage from './GuardScannerPage';

describe('GuardScannerPage (QR method)', () => {
    it('is switched off while the organization is on NFC: no scanner, no scan call', async () => {
        const { callsTo } = renderWithTrpc(<GuardScannerPage />, { 'attendance.method': () => ({ method: 'NFC' }) });

        expect(await screen.findByText('QR scanning is turned off')).toBeTruthy();
        expect(screen.queryByText(/Handheld scanner/i)).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
        expect(callsTo('attendance.scan')).toHaveLength(0);
    });

    it('shows the scanner when the organization is on QR', async () => {
        renderWithTrpc(<GuardScannerPage />, { 'attendance.method': () => ({ method: 'QR' }) });

        expect(await screen.findByText('Handheld scanner')).toBeTruthy();
        expect(screen.queryByText('QR scanning is turned off')).toBeNull();
    });

    it('shows nothing scannable while the method is still loading', () => {
        renderWithTrpc(<GuardScannerPage />, { 'attendance.method': () => new Promise(() => undefined) });

        expect(screen.queryByText('Handheld scanner')).toBeNull();
        expect(screen.queryByText('QR scanning is turned off')).toBeNull();
    });
});
