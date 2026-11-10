import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { escapeHtml } from './email.js';

const resend = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({
    Resend: class {
        emails = { send: resend.send };
    },
}));

describe('escapeHtml', () => {
    it('escapes HTML-significant characters', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('escapes ampersands, quotes, and apostrophes', () => {
        expect(escapeHtml(`Tom & Jerry's "Org"`)).toBe('Tom &amp; Jerry&#39;s &quot;Org&quot;');
    });

    it('leaves plain text unchanged', () => {
        expect(escapeHtml('Acme Processing Co.')).toBe('Acme Processing Co.');
    });
});

describe('sendRegistrationLinkEmail', () => {
    const args = ['jane@example.test', 'https://app.example.test/app/register?token=SECRET_TOKEN', 'Acme <Org>', 'Jane "JD" Doe', new Date('2031-03-05T10:00:00Z')] as const;
    let send: typeof import('./email.js').sendRegistrationLinkEmail;

    beforeEach(async () => {
        resend.send.mockReset();
        vi.stubEnv('RESEND_API_KEY', 're_test');
        vi.stubEnv('EMAIL_FROM', 'Bin Tracker <no-reply@example.test>');
        vi.resetModules();
        ({ sendRegistrationLinkEmail: send } = await import('./email.js'));
    });
    afterEach(() => vi.unstubAllEnvs());

    it('sends one email to the employee with the link, the instructions and the expiry', async () => {
        resend.send.mockResolvedValue({ data: { id: 'x' }, error: null });

        await send(...args);

        expect(resend.send).toHaveBeenCalledTimes(1);
        const msg = resend.send.mock.calls[0]![0];
        expect(msg).toMatchObject({ from: 'Bin Tracker <no-reply@example.test>', to: 'jane@example.test' });
        expect(msg.subject).toContain('Acme <Org>');
        expect(msg.html).toContain('href="https://app.example.test/app/register?token=SECRET_TOKEN"');
        expect(msg.html).toContain('Chrome or Safari');
        expect(msg.html).toContain('works once');
        expect(msg.html).toContain('Wed, 05 Mar 2031 10:00:00 UTC');
    });

    it('escapes the employee name, the organisation and the link before putting them in the HTML', async () => {
        resend.send.mockResolvedValue({ data: { id: 'x' }, error: null });

        await send('a@b.test', 'https://x.test/?a=1&b="2"', '<img src=x onerror=1>', '<script>alert(1)</script>', new Date());

        const html = resend.send.mock.calls[0]![0].html as string;
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('a=1&amp;b=&quot;2&quot;');
    });

    it('THROWS when the provider rejects the message (it returns { error } rather than throwing)', async () => {
        resend.send.mockResolvedValue({ data: null, error: { name: 'validation_error', statusCode: 422, message: 'echo https://app.example.test/app/register?token=SECRET_TOKEN' } });

        await expect(send(...args)).rejects.toThrow('validation_error, HTTP 422');
    });

    it('the thrown message never contains the provider text or the one-time link', async () => {
        resend.send.mockResolvedValue({ data: null, error: { name: 'application_error', statusCode: 500, message: 'echo token=SECRET_TOKEN' } });

        const e = await send(...args).then(() => null, (err: Error) => err);

        expect(e).toBeInstanceOf(Error);
        expect(e!.message).not.toContain('SECRET_TOKEN');
        expect(e!.message).not.toContain('echo');
    });

    it('throws when the sender address is not configured, and sends nothing', async () => {
        vi.stubEnv('EMAIL_FROM', '');

        await expect(send(...args)).rejects.toThrow('EMAIL_FROM not configured');
        expect(resend.send).not.toHaveBeenCalled();
    });

    it('throws when the mail key is not configured', async () => {
        vi.stubEnv('RESEND_API_KEY', '');

        await expect(send(...args)).rejects.toThrow('RESEND_API_KEY not configured');
    });
});
