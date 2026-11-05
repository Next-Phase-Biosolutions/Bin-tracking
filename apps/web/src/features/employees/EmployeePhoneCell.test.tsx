// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError } from '../../test/render';
import { renderWithTrpc } from '../../test/renderWithTrpc';
import { EmployeePhoneCell } from './EmployeePhoneCell';

const jane = { id: 'emp-1', fullName: 'Jane Doe', status: 'ACTIVE' as const };
const device = (n: number, over: object = {}) => ({
    id: `dev-${n}`, employeeId: 'emp-1', deviceLabel: n === 1 ? 'iPhone · Safari' : 'Android · Chrome',
    createdAt: new Date('2031-03-01T10:00:00'), lastUsedAt: new Date('2031-03-02T10:00:00'), ...over,
});
const handlers = { 'deviceRegistration.listDevices': () => [] };

describe('EmployeePhoneCell', () => {
    it('shows "Not set up" with no phone, and a count when there are some', () => {
        const none = renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[]} />, handlers);
        expect(screen.getByText('Not set up')).toBeTruthy();
        none.unmount();

        renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[device(1)]} />, handlers);
        expect(screen.getByText('1 phone')).toBeTruthy();
    });

    it('says 2 phones for two', () => {
        renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[device(1), device(2)]} />, handlers);
        expect(screen.getByText('2 phones')).toBeTruthy();
    });

    it('opens a dialog listing each registered phone', async () => {
        const user = userEvent.setup();
        renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[device(1), device(2)]} />, handlers);

        await user.click(screen.getByRole('button', { name: 'Manage phone for Jane Doe' }));

        const dialog = screen.getByRole('dialog', { name: 'Phone for Jane Doe' });
        expect(within(dialog).getByText('iPhone · Safari')).toBeTruthy();
        expect(within(dialog).getByText('Android · Chrome')).toBeTruthy();
    });

    it('closes on Escape and on the Close button', async () => {
        const user = userEvent.setup();
        renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[]} />, handlers);
        await user.click(screen.getByRole('button', { name: 'Manage phone for Jane Doe' }));

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Manage phone for Jane Doe' }));
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('creates a registration link and shows it with its expiry and the WhatsApp tip', async () => {
        const user = userEvent.setup();
        const { callsTo } = renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[]} />, {
            ...handlers,
            'deviceRegistration.sendLink': () => ({ link: 'https://example.test/app/register?token=abc', expiresAt: new Date('2031-03-05T10:00:00'), employeeName: 'Jane Doe' }),
        });
        await user.click(screen.getByRole('button', { name: 'Manage phone for Jane Doe' }));

        await user.click(screen.getByRole('button', { name: 'Create registration link' }));

        const field = (await screen.findByLabelText('Registration link for Jane Doe')) as HTMLInputElement;
        expect(field.value).toBe('https://example.test/app/register?token=abc');
        expect(callsTo('deviceRegistration.sendLink')[0]!.input).toEqual({ employeeId: 'emp-1' });
        expect(screen.getByText(/Works once and expires/)).toBeTruthy();
        expect(screen.getByText(/Chrome or Safari/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Create a new link' })).toBeTruthy();
    });

    it('cannot make a link for an inactive employee', async () => {
        const user = userEvent.setup();
        renderWithTrpc(<EmployeePhoneCell employee={{ ...jane, status: 'INACTIVE' }} devices={[]} />, handlers);
        await user.click(screen.getByRole('button', { name: 'Manage phone for Jane Doe' }));

        expect(screen.getByText(/inactive/)).toBeTruthy();
        expect((screen.getByRole('button', { name: 'Create registration link' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('explains a failure to create a link', async () => {
        const user = userEvent.setup();
        renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[]} />, {
            ...handlers, 'deviceRegistration.sendLink': () => { throw apiError('EMPLOYEE_NOT_FOUND', 404); },
        });
        await user.click(screen.getByRole('button', { name: 'Manage phone for Jane Doe' }));

        await user.click(screen.getByRole('button', { name: 'Create registration link' }));

        expect((await screen.findByRole('alert')).textContent).toContain('no longer exists');
    });

    it('revoking a phone takes two clicks and then refreshes the device list', async () => {
        const user = userEvent.setup();
        const { callsTo } = renderWithTrpc(<EmployeePhoneCell employee={jane} devices={[device(1)]} />, {
            ...handlers, 'deviceRegistration.revokeDevice': () => ({ revoked: true }),
        });
        await user.click(screen.getByRole('button', { name: 'Manage phone for Jane Doe' }));

        await user.click(screen.getByRole('button', { name: 'Revoke iPhone · Safari' }));
        expect(callsTo('deviceRegistration.revokeDevice')).toHaveLength(0);
        await user.click(screen.getByRole('button', { name: /Revoke phone — click again to confirm/ }));

        await waitFor(() => expect(callsTo('deviceRegistration.revokeDevice')[0]!.input).toEqual({ id: 'dev-1' }));
        await waitFor(() => expect(callsTo('deviceRegistration.listDevices').length).toBeGreaterThanOrEqual(0));
    });
});
