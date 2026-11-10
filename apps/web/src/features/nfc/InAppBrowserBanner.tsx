import { isLikelyInAppBrowser } from '../../lib/inAppBrowser';

/**
 * Shown inside WhatsApp / Instagram / Facebook webviews. They keep their own
 * cookie jar, so a phone registered there is NOT registered in the system
 * browser an NFC tap opens. Advice only: it never blocks the flow.
 */
export function InAppBrowserBanner({ userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent }: { userAgent?: string }) {
    if (!isLikelyInAppBrowser(userAgent)) return null;
    return (
        <p role="note" className="mb-4 rounded-xl border border-warn/50 bg-warn/20 px-4 py-3 text-left text-sm text-ink">
            You’re inside another app (like WhatsApp or Instagram). Open this link in <strong>Chrome</strong> or <strong>Safari</strong> instead, so your phone
            stays registered for clocking in.
        </p>
    );
}
