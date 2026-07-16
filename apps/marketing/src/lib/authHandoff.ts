// The facility app lives at its own origin. Set VITE_APP_URL to the app
// domain (e.g. https://app.nextphasebiosolutions.com) before deploying;
// defaults to the local dev port.
export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

/**
 * Hands a freshly-created Supabase session off to the app origin. Supabase
 * sessions are stored per-origin, so a session created here on the marketing
 * site isn't visible to the app at its own origin — the access/refresh
 * tokens are carried across in the URL **hash** (never the query string, and
 * never sent to a server or included in Referer headers) for the app's
 * /auth/callback route to pick up and call supabase.auth.setSession() with.
 * The app clears the hash immediately after consuming it.
 */
export function handoffToApp(accessToken: string, refreshToken: string): void {
    const hash = new URLSearchParams({ access_token: accessToken, refresh_token: refreshToken }).toString();
    window.location.href = `${APP_URL}/auth/callback#${hash}`;
}
