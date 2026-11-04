// @vitest-environment jsdom
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { apiError, gatewayError, renderAt } from '../../test/render';

const tapMutate = vi.hoisted(() => vi.fn());
const startMutate = vi.hoisted(() => vi.fn());
vi.mock('../../lib/phone-client', () => ({
    phoneClient: { attendance: { tap: { mutate: tapMutate } }, deviceRegistration: { start: { mutate: startMutate } } },
}));

import TapPage from './TapPage';
import RegisterPage from './RegisterPage';

const at = new Date('2031-03-03T14:05:00');
const WHATSAPP_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36';

beforeEach(() => {
    tapMutate.mockReset();
    startMutate.mockReset();
});

const tapPage = (route = '/app/tap?card=card-1') => renderAt(<TapPage retryDelayMs={0} />, route);

describe('TapPage', () => {
    it('sends the card id from the URL and shows a check-in', async () => {
        tapMutate.mockResolvedValue({ status: 'CHECK_IN', at, employeeName: 'Jane Doe', debounced: false });

        tapPage();

        expect((await screen.findByRole('status')).textContent).toContain('Checked in at');
        expect(screen.getByText('Jane Doe')).toBeTruthy();
        expect(tapMutate).toHaveBeenCalledWith({ cardId: 'card-1' });
    });

    it('shows hours worked on a check-out', async () => {
        tapMutate.mockResolvedValue({ status: 'CHECK_OUT', at, employeeName: 'Jane Doe', durationMin: 489, debounced: false });

        tapPage();

        expect((await screen.findByRole('status')).textContent).toContain('Worked 8h 9m');
    });

    it('explains a direction mismatch, which arrives as a normal result and not as an error', async () => {
        tapMutate.mockResolvedValue({ status: 'ALREADY_CHECKED_IN', at, since: at, employeeName: 'Jane', debounced: false });

        tapPage();

        const note = await screen.findByRole('status');
        expect(note.textContent).toContain('Already checked in');
        expect(note.textContent).toContain('Tap the OUT card');
    });

    it('says "Not checked in" and which card to use', async () => {
        tapMutate.mockResolvedValue({ status: 'NOT_CHECKED_IN', at, employeeName: 'Jane', debounced: false });

        tapPage();

        expect((await screen.findByRole('status')).textContent).toContain('Tap the IN card');
    });

    it('confirms a completed registration', async () => {
        tapMutate.mockResolvedValue({ status: 'REGISTRATION_COMPLETE', at, employeeName: 'Jane', debounced: false });

        tapPage();

        expect((await screen.findByRole('status')).textContent).toContain('Phone registered!');
    });

    it('renders a double-tap echo exactly like the original', async () => {
        tapMutate.mockResolvedValue({ status: 'CHECK_IN', at, employeeName: 'Jane Doe', debounced: false });
        const first = tapPage();
        const original = (await screen.findByRole('status')).innerHTML;
        first.unmount();

        tapMutate.mockResolvedValue({ status: 'CHECK_IN', at, employeeName: 'Jane Doe', debounced: true });
        tapPage();

        expect((await screen.findByRole('status')).innerHTML).toBe(original);
    });

    it('with no card in the URL it explains how to tap and never calls the API', () => {
        tapPage('/app/tap');

        expect(screen.getByRole('alert').textContent).toContain('No card detected');
        expect(tapMutate).not.toHaveBeenCalled();
    });

    it.each([
        ['NO_SESSION', 401, 'Phone not registered'],
        ['SESSION_REVOKED', 403, 'Phone not allowed'],
        ['EMPLOYEE_INACTIVE', 403, 'Account inactive'],
        ['CARD_INACTIVE', 403, 'Card not active'],
        ['CARD_NOT_FOUND', 404, 'Card not recognised'],
        ['MODULE_DISABLED', 403, 'Attendance is off'],
        ['TOKEN_EXPIRED', 400, 'Link expired'],
        ['TOKEN_ALREADY_USED', 409, 'Link already used'],
    ])('shows a specific message for %s and does NOT retry it', async (appCode, status, title) => {
        tapMutate.mockRejectedValue(apiError(appCode, status));

        tapPage();

        expect((await screen.findByRole('alert')).textContent).toContain(title);
        expect(tapMutate).toHaveBeenCalledTimes(1);
    });

    it('retries a gateway failure and then succeeds, showing the waking state in between', async () => {
        tapMutate.mockRejectedValueOnce(gatewayError()).mockRejectedValueOnce(apiError('SERVER_BUSY', 429)).mockResolvedValue({
            status: 'CHECK_IN', at, employeeName: 'Jane', debounced: false,
        });

        tapPage();

        expect((await screen.findByRole('status')).textContent).toContain('Checked in');
        expect(tapMutate).toHaveBeenCalledTimes(3);
    });

    it('gives up after 3 retries (4 attempts) with a generic message', async () => {
        tapMutate.mockRejectedValue(gatewayError());

        tapPage();

        expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong');
        expect(tapMutate).toHaveBeenCalledTimes(4);
    });

    it('tells the employee the system is busy when the server stays overloaded', async () => {
        tapMutate.mockRejectedValue(apiError('SERVER_BUSY', 429));

        tapPage();

        expect((await screen.findByRole('alert')).textContent).toContain('The system is busy');
    });

    it('calls the API once even under StrictMode, which double-runs effects in development', async () => {
        tapMutate.mockResolvedValue({ status: 'CHECK_IN', at, employeeName: 'Jane', debounced: false });

        renderAt(<StrictMode><TapPage retryDelayMs={0} /></StrictMode>, '/app/tap?card=card-1');

        await screen.findByRole('status');
        expect(tapMutate).toHaveBeenCalledTimes(1);
    });

    it('warns a phone inside WhatsApp to open the system browser when it is not registered', async () => {
        vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WHATSAPP_UA);
        tapMutate.mockRejectedValue(apiError('NO_SESSION', 401));

        tapPage();

        await screen.findByRole('alert');
        expect(screen.getByRole('note').textContent).toContain('Chrome');
        vi.restoreAllMocks();
    });
});

describe('RegisterPage', () => {
    const page = (route = '/app/register?token=abc') => renderAt(<RegisterPage />, route);

    it('greets the employee and asks them to tap the card, with nothing to type', async () => {
        startMutate.mockResolvedValue({ employeeName: 'Jane Doe' });

        const { container } = page();

        // "Checking…" and the result share one live region, so wait for the text, not the role.
        expect(await screen.findByText('Hi Jane Doe!')).toBeTruthy();
        expect(screen.getByText(/tap the NFC card/i)).toBeTruthy();
        expect(container.querySelector('input, form, button')).toBeNull();
        expect(startMutate).toHaveBeenCalledWith({ token: 'abc' });
    });

    it('needs a token: without one it says so and never calls the API', () => {
        page('/app/register');

        expect(screen.getByRole('alert').textContent).toContain('needs a registration link');
        expect(startMutate).not.toHaveBeenCalled();
    });

    it.each([
        ['TOKEN_EXPIRED', 'has expired'],
        ['TOKEN_ALREADY_USED', 'already used'],
        ['TOKEN_SUPERSEDED', 'newer registration link'],
        ['TOKEN_NOT_FOUND', 'isn’t valid'],
        ['EMPLOYEE_INACTIVE', 'inactive'],
    ])('explains %s', async (appCode, phrase) => {
        startMutate.mockRejectedValue(apiError(appCode, 409));

        page();

        expect((await screen.findByRole('alert')).textContent).toContain(phrase);
    });

    it('treats an unexpected failure as "try again", not as a bad link', async () => {
        startMutate.mockRejectedValue(gatewayError());

        page();

        expect((await screen.findByRole('alert')).textContent).toContain('couldn’t check this link right now');
    });

    it('checks the link once, even under StrictMode', async () => {
        startMutate.mockResolvedValue({ employeeName: 'Jane' });

        renderAt(<StrictMode><RegisterPage /></StrictMode>, '/app/register?token=abc');

        await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Hi Jane'));
        expect(startMutate).toHaveBeenCalledTimes(1);
    });

    it('shows the open-in-Chrome/Safari banner inside an in-app browser, without blocking the flow', async () => {
        vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WHATSAPP_UA);
        startMutate.mockResolvedValue({ employeeName: 'Jane' });

        page();

        expect(screen.getByRole('note').textContent).toContain('Chrome');
        expect(await screen.findByText('Hi Jane!')).toBeTruthy();
        vi.restoreAllMocks();
    });
});
