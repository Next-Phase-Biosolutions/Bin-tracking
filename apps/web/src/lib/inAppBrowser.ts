/**
 * Best-effort check for in-app browsers (WhatsApp, Instagram, Facebook, …).
 * They keep their own cookie jar, so a phone registered inside one is not
 * registered in Chrome/Safari, where the NFC tap opens. Detection is
 * user-agent sniffing and can miss an unusual webview; the banner it drives is
 * advice, not a gate.
 */
const IN_APP_UA = /; wv\)|FBAN|FBAV|FB_IAB|Instagram|Snapchat|MicroMessenger|TikTok|Twitter|Line\//i;
const IOS_UA = /iPhone|iPad|iPod/;

export function isLikelyInAppBrowser(userAgent: string): boolean {
    if (IN_APP_UA.test(userAgent)) return true;
    // iOS webviews have no "Safari/" token; real Safari and Chrome-on-iOS do.
    return IOS_UA.test(userAgent) && !/Safari\//.test(userAgent);
}
