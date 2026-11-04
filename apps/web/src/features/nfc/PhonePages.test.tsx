// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    it('gives up after 3 retries (4 attempts) and says it could not CONFIRM the tap, rather than claiming a failure', async () => {
        tapMutate.mockRejectedValue(gatewayError());

        tapPage();

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('Couldn’t confirm your tap');
        expect(alert.textContent).toContain('tap the card again');
        expect(tapMutate).toHaveBeenCalledTimes(4);
    });

    describe('a retry can never record a second punch', () => {
        afterEach(() => vi.restoreAllMocks());

        /** Makes Date.now() jump by `stepMs` per call, so the page sees time pass without real waiting. */
        function advanceClock(stepMs: number) {
            let now = 1_000_000;
            vi.spyOn(Date, 'now').mockImplementation(() => (now += stepMs));
        }

        it('does NOT repeat an ambiguous failure once it is past the debounce-safe window (the tap may have been recorded)', async () => {
            advanceClock(5_000); // by the time attempt 1 fails, 5 s have passed: a repeat could be a real second tap
            tapMutate.mockRejectedValue(gatewayError());

            tapPage();

            expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t confirm your tap');
            expect(tapMutate).toHaveBeenCalledTimes(1);
        });

        it('still repeats an HTTP 429 however late it is, because nothing was recorded', async () => {
            advanceClock(5_000);
            tapMutate.mockRejectedValue(apiError('SERVER_BUSY', 429));

            tapPage();

            expect((await screen.findByRole('alert')).textContent).toContain('The system is busy');
            expect(tapMutate).toHaveBeenCalledTimes(4);
        });

        it('once a failure was ambiguous, even a later 429 is not retried past the window, and the message is "couldn\u2019t confirm", not "busy"', async () => {
            // gateway error (the tap may have been recorded), then 429s. Telling the employee "busy, tap again"
            // here could invite a deliberate second tap on top of a punch that may already exist.
            advanceClock(1_000);
            tapMutate
                .mockRejectedValueOnce(gatewayError())
                .mockRejectedValueOnce(apiError('SERVER_BUSY', 429))
                .mockRejectedValue(apiError('SERVER_BUSY', 429));

            tapPage();

            const alert = await screen.findByRole('alert');
            expect(alert.textContent).toContain('Couldn’t confirm your tap');
            expect(alert.textContent).not.toContain('The system is busy');
            expect(tapMutate).toHaveBeenCalledTimes(3); // the 4th would have been sent past the 3 s bound
        });

        it('counts the delay before a retry, not just the time already elapsed', async () => {
            // The failure is detected at 2 s; a retry sent after the 1.2 s delay would go out at 3.2 s: too late.
            advanceClock(2_000);
            tapMutate.mockRejectedValue(gatewayError());

            renderAt(<TapPage retryDelayMs={1200} />, '/app/tap?card=card-1');

            expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t confirm your tap');
            expect(tapMutate).toHaveBeenCalledTimes(1);
        });

        it('shows a definitive answer as such even after an ambiguous failure', async () => {
            tapMutate.mockRejectedValueOnce(gatewayError()).mockRejectedValue(apiError('SESSION_REVOKED', 403));

            tapPage();

            expect((await screen.findByRole('alert')).textContent).toContain('Phone not allowed');
        });

        it('says so plainly when one phone taps too often', async () => {
            tapMutate.mockRejectedValue(apiError('TOO_MANY_TAPS', 429));

            tapPage();

            expect((await screen.findByRole('alert')).textContent).toContain('Too many taps');
        });
    });

    it('keeps <main> as the page landmark, with the status inside it', async () => {
        tapMutate.mockResolvedValue({ status: 'CHECK_IN', at, employeeName: 'Jane', debounced: false });

        tapPage();

        const status = await screen.findByRole('status');
        expect(screen.getByRole('main').contains(status)).toBe(true);
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
