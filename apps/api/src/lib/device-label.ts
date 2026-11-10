/**
 * Coarse, human label for a registered phone ("iPhone · Safari"), derived from
 * the user agent at registration so admins can tell devices apart. Best-effort
 * display text only — never used for any decision.
 */
export function deviceLabelFromUserAgent(ua: string | undefined): string {
    if (!ua) return 'Unknown phone';
    const os = /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'Phone';
    // Order matters: Edge and Chrome UAs both contain "Safari"; Edge also contains "Chrome".
    let browser = 'browser';
    if (/FBAN|FBAV|Instagram|Snapchat|MicroMessenger|TikTok|Line\//.test(ua)) browser = 'in-app browser';
    else if (/EdgA?\/|Edg\//.test(ua)) browser = 'Edge';
    else if (/FxiOS|Firefox/.test(ua)) browser = 'Firefox';
    else if (/CriOS|Chrome/.test(ua)) browser = 'Chrome';
    else if (/Safari/.test(ua)) browser = 'Safari';
    return `${os} · ${browser}`;
}
