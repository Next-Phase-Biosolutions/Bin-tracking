import { describe, expect, it } from 'vitest';
import { isLikelyInAppBrowser } from './inAppBrowser';

const UA = {
    chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1',
    whatsappAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36',
    instagramIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0',
    facebookAndroid: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]',
    whatsappIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

describe('isLikelyInAppBrowser', () => {
    it.each(['chromeAndroid', 'safariIphone', 'chromeIphone'] as const)('does not flag a real browser (%s)', (name) => {
        expect(isLikelyInAppBrowser(UA[name])).toBe(false);
    });

    it.each(['whatsappAndroid', 'instagramIphone', 'facebookAndroid', 'whatsappIphone'] as const)('flags an in-app webview (%s)', (name) => {
        expect(isLikelyInAppBrowser(UA[name])).toBe(true);
    });

    it('does not flag an empty user agent', () => {
        expect(isLikelyInAppBrowser('')).toBe(false);
    });
});
