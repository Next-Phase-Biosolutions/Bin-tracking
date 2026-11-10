// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError } from '../../test/render';
import { renderWithTrpc } from '../../test/renderWithTrpc';
import { EmployeePhoneCell } from './EmployeePhoneCell';

const jane = { id: 'emp-1', fullName: 'Jane Doe', status: 'ACTIVE' as const, email: 'jane@example.test' };
const noMail = { ...jane, email: null };

const linkFor = (token: string) => ({ link: `https://example.test/app/register?token=${token}`, expiresAt: new Date('2031-03-05T10:00:00'), employeeName: 'Jane Doe' });
const base = { 'deviceRegistration.listDevices': () => [] };

/** Opens the dialog and creates a link; returns the user and the call recorder. */
async function openWithLink(employee: typeof jane | typeof noMail, extra: Record<string, (input: unknown, n: number) => unknown> = {}) {
    const user = userEvent.setup();
    let issued = 0;
    const r = renderWithTrpc(<EmployeePhoneCell employee={employee} devices={[]} />, {
        ...base,
        'deviceRegistration.sendLink': () => linkFor(`tok-${++issued}`),
        'deviceRegistration.emailLink': () => ({ email: employee.email, sentAt: new Date('2031-03-03T09:42:00') }),
        ...extra,
    });
    await user.click(screen.getByRole('button', { name: `Manage phone for ${employee.fullName}` }));
    await user.click(screen.getByRole('button', { name: 'Create registration link' }));
    await screen.findByLabelText('Registration link for Jane Doe');
    return { user, ...r };
}
const close = () => screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement;
const sendBtn = () => screen.getByRole('button', { name: /Send link to jane@example.test|Try again/ }) as HTMLButtonElement;

describe('Manage dialog: send the registration link by email', () => {
    it('before any link exists nothing is locked and there is nothing to send', async () => {
        const user = userEvent.setup();
        renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[]} />, base);
        await user.click(screen.getByRole('button', { name: 'Manage phone for Jane Doe' }));

        expect(close().disabled).toBe(false);
        expect(screen.queryByRole('button', { name: /Send link/ })).toBeNull();
    });

    it('once a link exists, the Send button appears and Close is locked with an explanation', async () => {
        await openWithLink(jane);

        expect(sendBtn().textContent).toContain('jane@example.test');
        expect(close().disabled).toBe(true);
        expect(screen.getByText('Send the link first to close this window.')).toBeTruthy();
        expect(close().getAttribute('aria-describedby')).toBe('close-locked-hint');
    });

    it('while locked, neither Escape nor a click outside the dialog closes it', async () => {
        const { user } = await openWithLink(jane);

        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('dialog'));

        expect(screen.getByRole('dialog', { name: 'Phone for Jane Doe' })).toBeTruthy();
    });

    it('sends exactly the token from the link, stays locked while sending, then confirms and unlocks', async () => {
        let release!: (v: unknown) => void;
        const { user, callsTo } = await openWithLink(jane, { 'deviceRegistration.emailLink': () => new Promise((resolve) => (release = resolve)) });

        await user.click(sendBtn());

        await waitFor(() => expect(screen.getByRole('button', { name: 'Sending…' })).toBeTruthy());
        expect(close().disabled).toBe(true);
        expect(callsTo('deviceRegistration.emailLink')[0]!.input).toEqual({ employeeId: 'emp-1', token: 'tok-1' });

        release({ email: 'jane@example.test', sentAt: new Date('2031-03-03T09:42:00') });

        expect((await screen.findByRole('status')).textContent).toContain('Link emailed to jane@example.test');
        expect(close().disabled).toBe(false);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('"Send again" emails the same link once more and Close stays available', async () => {
        const { user, callsTo } = await openWithLink(jane);
        await user.click(sendBtn());
        await screen.findByText(/Link emailed to/);

        await user.click(screen.getByRole('button', { name: 'Send again' }));

        await waitFor(() => expect(callsTo('deviceRegistration.emailLink')).toHaveLength(2));
        expect(callsTo('deviceRegistration.emailLink')[1]!.input).toEqual({ employeeId: 'emp-1', token: 'tok-1' });
        await screen.findByText(/Link emailed to/);
        expect(close().disabled).toBe(false);
    });

    it('a failed send shows the reason, keeps Close locked, and a retry that works unlocks it', async () => {
        const { user } = await openWithLink(jane, {
            'deviceRegistration.emailLink': (_in, n) => {
                if (n === 1) throw apiError('EMAIL_FAILED', 502);
                return { email: 'jane@example.test', sentAt: new Date('2031-03-03T09:45:00') };
            },
        });

        await user.click(sendBtn());

        expect((await screen.findByRole('alert')).textContent).toContain('The email could not be sent');
        expect(close().disabled).toBe(true);
        expect(sendBtn().textContent).toContain('Try again');

        await user.click(sendBtn());

        await screen.findByText(/Link emailed to/);
        expect(close().disabled).toBe(false);
    });

    it('creating a NEW link after sending locks Close again until that new link is emailed', async () => {
        const { user, callsTo } = await openWithLink(jane);
        await user.click(sendBtn());
        await screen.findByText(/Link emailed to/);
        expect(close().disabled).toBe(false);

        await user.click(screen.getByRole('button', { name: 'Create a new link' }));

        await waitFor(() => expect(callsTo('deviceRegistration.sendLink')).toHaveLength(2));
        await waitFor(() => expect(close().disabled).toBe(true));
        expect(screen.queryByText(/Link emailed to/)).toBeNull();
        await user.click(sendBtn());
        await screen.findByText(/Link emailed to/);
        expect(callsTo('deviceRegistration.emailLink')[1]!.input).toEqual({ employeeId: 'emp-1', token: 'tok-2' }); // the NEW token
        expect(close().disabled).toBe(false);
    });

    it('Close is locked while a link is being created (it would replace the one just emailed)', async () => {
        let release!: (v: unknown) => void;
        let n = 0;
        const { user } = await openWithLink(jane, {
            'deviceRegistration.sendLink': () => (++n === 1 ? linkFor('tok-1') : new Promise((resolve) => (release = resolve))),
        });
        await user.click(sendBtn());
        await screen.findByText(/Link emailed to/);

        await user.click(screen.getByRole('button', { name: 'Create a new link' }));

        await waitFor(() => expect(close().disabled).toBe(true));
        release(linkFor('tok-2'));
        await waitFor(() => expect(screen.getByRole('button', { name: /Send link to/ })).toBeTruthy());
    });

    it('an employee with no email: Send is disabled with an explanation and Close is NOT locked', async () => {
        const { user } = await openWithLink(noMail);

        expect((screen.getByRole('button', { name: '✉ Send link by email' }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText(/has no email address on file/)).toBeTruthy();
        expect(screen.getByLabelText('Registration link for Jane Doe')).toBeTruthy(); // the link can still be copied
        expect(close().disabled).toBe(false);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('an email of only spaces counts as no email', async () => {
        await openWithLink({ ...jane, email: '   ' } as never);

        expect(screen.getByText(/has no email address on file/)).toBeTruthy();
        expect(close().disabled).toBe(false);
    });
});
