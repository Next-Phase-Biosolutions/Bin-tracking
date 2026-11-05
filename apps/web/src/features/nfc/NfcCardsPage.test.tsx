// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError } from '../../test/render';
import { renderWithTrpc } from '../../test/renderWithTrpc';

const subscription = vi.hoisted(() => ({ hasWorkforce: true }));
vi.mock('../../context/SubscriptionContext', () => ({
    useSubscription: () => ({ hasModule: () => subscription.hasWorkforce, isLoading: false }),
}));

import NfcCardsPage from './NfcCardsPage';

const card = (over: Partial<{ id: string; label: string; direction: 'IN' | 'OUT' | 'BOTH'; chipUid: string; active: boolean }> = {}) => ({
    id: 'card-1', organizationId: 'org-1', label: 'Main entrance', direction: 'BOTH' as const, chipUid: '04A1', active: true, createdAt: new Date(), updatedAt: new Date(), ...over,
});

const admin = { orgRole: 'ADMIN' };
// The origin to write into tags comes from the SERVER's APP_URL, not from the admin's own browser.
const TAG_BASE = 'https://app.example.test';
beforeEach(() => {
    subscription.hasWorkforce = true;
});

describe('NfcCardsPage', () => {
    it('says NFC taps are switched off while the organization is on the QR method, and still lets the admin prepare cards', async () => {
        renderWithTrpc(<NfcCardsPage />, { 'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [], 'attendance.method': () => ({ method: 'QR' }) });

        expect(await screen.findByText(/NFC taps are switched off/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add card' })).toBeTruthy();
    });

    it('shows no such notice while the organization is on NFC', async () => {
        renderWithTrpc(<NfcCardsPage />, { 'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [], 'attendance.method': () => ({ method: 'NFC' }) });

        await screen.findByText(/No cards yet/i);
        expect(screen.queryByText(/NFC taps are switched off/i)).toBeNull();
    });

    it('lists each card with its direction, state and a tag URL built from the CARD id', async () => {
        renderWithTrpc(<NfcCardsPage />, { 'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [card(), card({ id: 'card-2', label: 'Dock', direction: 'OUT', active: false, chipUid: '04B2' })] });

        expect(await screen.findByText('Main entrance')).toBeTruthy();
        expect(screen.getByText('Dock')).toBeTruthy();
        expect((screen.getByLabelText('Tag URL for Main entrance') as HTMLInputElement).value).toBe(`${TAG_BASE}/app/tap?card=card-1`);
        expect((screen.getByLabelText('Tag URL for Dock') as HTMLInputElement).value).toContain('card=card-2');
        expect(screen.getByText('IN + OUT')).toBeTruthy();
        expect(screen.getByText('Inactive')).toBeTruthy();
    });

    it('never shows a tag URL until the server has said which origin to use (no guessing from the browser)', async () => {
        let release!: (v: { url: string }) => void;
        renderWithTrpc(<NfcCardsPage />, {
            'auth.me': () => admin,
            'nfcCard.list': () => [card()],
            'nfcCard.tagBaseUrl': () => new Promise((resolve) => (release = resolve)),
        });

        await screen.findByText('Main entrance');
        expect(screen.getByText('Loading tag URL…')).toBeTruthy();
        expect(screen.queryByLabelText('Tag URL for Main entrance')).toBeNull();

        release({ url: TAG_BASE });
        expect(await screen.findByLabelText('Tag URL for Main entrance')).toBeTruthy();
    });

    it('copies the tag URL with the Copy button', async () => {
        const user = userEvent.setup(); // installs its own clipboard stub, so spy on it afterwards
        const clipboard = vi.spyOn(navigator.clipboard, 'writeText');
        renderWithTrpc(<NfcCardsPage />, { 'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [card()] });
        await screen.findByText('Main entrance');

        await user.click(screen.getByRole('button', { name: 'Copy' }));

        expect(clipboard).toHaveBeenCalledWith(`${TAG_BASE}/app/tap?card=card-1`);
        expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
    });

    it('shows an empty state', async () => {
        renderWithTrpc(<NfcCardsPage />, { 'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [] });
        expect(await screen.findByText(/No cards yet/)).toBeTruthy();
    });

    it('adds a card, clears the form, and shows the new card from a fresh fetch', async () => {
        const user = userEvent.setup();
        const server = [card()];
        const { callsTo } = renderWithTrpc(<NfcCardsPage />, {
            'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }),
            'nfcCard.list': () => [...server],
            'nfcCard.create': (input) => {
                const created = card({ id: 'card-9', ...(input as object) });
                server.push(created);
                return created;
            },
        });
        await screen.findByText('Main entrance');

        await user.type(screen.getByPlaceholderText('Main entrance'), 'Loading dock');
        await user.type(screen.getByPlaceholderText(/printed on the tag/), '04ZZ');
        await user.selectOptions(screen.getByDisplayValue('IN + OUT (one card toggles)'), 'OUT');
        await user.click(screen.getByRole('button', { name: 'Add card' }));

        expect(await screen.findByText('Loading dock')).toBeTruthy();
        expect(callsTo('nfcCard.create')[0]!.input).toEqual({ label: 'Loading dock', direction: 'OUT', chipUid: '04ZZ' });
        expect((screen.getByPlaceholderText('Main entrance') as HTMLInputElement).value).toBe('');
    });

    it('a card added while the very first load is still in flight is not lost to a stale request', async () => {
        // The bug refreshQuery exists for: a plain invalidate() merges into the in-flight request.
        const user = userEvent.setup();
        let releaseFirst!: (rows: unknown[]) => void;
        const server: ReturnType<typeof card>[] = [];
        renderWithTrpc(<NfcCardsPage />, {
            'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }),
            'nfcCard.list': (_input, n) => (n === 1 ? new Promise((resolve) => (releaseFirst = resolve)) : [...server]),
            'nfcCard.create': (input) => {
                const created = card({ id: 'card-new', ...(input as object) });
                server.push(created);
                return created;
            },
        });
        await waitFor(() => expect(screen.getByPlaceholderText('Main entrance')).toBeTruthy());

        await user.type(screen.getByPlaceholderText('Main entrance'), 'Late save');
        await user.type(screen.getByPlaceholderText(/printed on the tag/), '04LATE');
        await user.click(screen.getByRole('button', { name: 'Add card' }));
        releaseFirst([]); // the stale first response arrives AFTER the save

        expect(await screen.findByText('Late save')).toBeTruthy();
    });

    it('explains a duplicate chip UID', async () => {
        const user = userEvent.setup();
        renderWithTrpc(<NfcCardsPage />, {
            'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }),
            'nfcCard.list': () => [],
            'nfcCard.create': () => { throw apiError('DUPLICATE_CHIP_UID', 409); },
        });
        await screen.findByText(/No cards yet/);

        await user.type(screen.getByPlaceholderText('Main entrance'), 'Door');
        await user.type(screen.getByPlaceholderText(/printed on the tag/), '04A1');
        await user.click(screen.getByRole('button', { name: 'Add card' }));

        expect((await screen.findByRole('alert')).textContent).toContain('chip UID already exists');
    });

    it('deactivates a card', async () => {
        const user = userEvent.setup();
        const { callsTo } = renderWithTrpc(<NfcCardsPage />, {
            'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [card()], 'nfcCard.setActive': () => card({ active: false }),
        });
        await screen.findByText('Main entrance');

        await user.click(screen.getByRole('button', { name: 'Deactivate' }));

        await waitFor(() => expect(callsTo('nfcCard.setActive')[0]!.input).toEqual({ id: 'card-1', active: false }));
    });

    it('deleting takes two clicks, and the first only arms the button', async () => {
        const user = userEvent.setup();
        const { callsTo } = renderWithTrpc(<NfcCardsPage />, {
            'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [card()], 'nfcCard.remove': () => ({ deleted: true }),
        });
        await screen.findByText('Main entrance');

        await user.click(screen.getByRole('button', { name: 'Delete Main entrance' }));
        expect(callsTo('nfcCard.remove')).toHaveLength(0);
        await user.click(screen.getByRole('button', { name: /Delete card — click again to confirm/ }));

        await waitFor(() => expect(callsTo('nfcCard.remove')[0]!.input).toEqual({ id: 'card-1' }));
    });

    describe('editing', () => {
        async function openEdit() {
            const user = userEvent.setup();
            const view = renderWithTrpc(<NfcCardsPage />, {
                'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [card()], 'nfcCard.update': (input) => card(input as object),
            });
            await screen.findByText('Main entrance');
            await user.click(screen.getByRole('button', { name: 'Edit Main entrance' }));
            return { user, ...view };
        }

        it('sends only the fields that changed', async () => {
            const { user, callsTo } = await openEdit();

            const form = within(screen.getByRole('form', { name: 'Edit Main entrance' }));
            await user.clear(form.getByLabelText('Label'));
            await user.type(form.getByLabelText('Label'), 'Front door');
            await user.click(form.getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(callsTo('nfcCard.update')[0]!.input).toEqual({ id: 'card-1', label: 'Front door' }));
        });

        it('says "Nothing has changed." and sends nothing when there is no edit', async () => {
            const { user, callsTo } = await openEdit();

            await user.click(screen.getByRole('button', { name: 'Save' }));

            expect((await screen.findByRole('status')).textContent).toBe('Nothing has changed.');
            expect(callsTo('nfcCard.update')).toHaveLength(0);
        });

        it('asks for confirmation before changing what a tap does, then sends it', async () => {
            const { user, callsTo } = await openEdit();

            const form = within(screen.getByRole('form', { name: 'Edit Main entrance' }));
            await user.selectOptions(form.getByLabelText('What a tap does'), 'IN');
            await user.click(form.getByRole('button', { name: 'Save' }));

            expect(callsTo('nfcCard.update')).toHaveLength(0);
            expect(form.getByRole('alert').textContent).toContain('Tags already written keep working');
            await user.click(form.getByRole('button', { name: 'Confirm change' }));
            await waitFor(() => expect(callsTo('nfcCard.update')[0]!.input).toEqual({ id: 'card-1', direction: 'IN' }));
        });

        it('withdraws the confirmation if the direction is changed back', async () => {
            const { user } = await openEdit();

            const form = within(screen.getByRole('form', { name: 'Edit Main entrance' }));
            await user.selectOptions(form.getByLabelText('What a tap does'), 'IN');
            await user.click(form.getByRole('button', { name: 'Save' }));
            await user.selectOptions(form.getByLabelText('What a tap does'), 'BOTH');

            expect(form.queryByRole('button', { name: 'Confirm change' })).toBeNull();
        });
    });

    it('is closed to a driver or worker, and never asks the API for cards', async () => {
        const { callsTo } = renderWithTrpc(<NfcCardsPage />, { 'auth.me': () => ({ orgRole: 'WORKER' }), 'nfcCard.list': () => [] });

        expect(await screen.findByText(/available to admins and ops managers only/)).toBeTruthy();
        expect(callsTo('nfcCard.list')).toHaveLength(0);
    });

    it('shows the upgrade prompt when the organisation has no workforce module', async () => {
        subscription.hasWorkforce = false;
        const { callsTo } = renderWithTrpc(<NfcCardsPage />, { 'auth.me': () => admin, 'nfcCard.tagBaseUrl': () => ({ url: TAG_BASE }), 'nfcCard.list': () => [], 'billing.status': () => ({}) });

        await waitFor(() => expect(callsTo('nfcCard.list')).toHaveLength(0));
        expect(within(document.body).queryByText('Add a card')).toBeNull();
    });
});
