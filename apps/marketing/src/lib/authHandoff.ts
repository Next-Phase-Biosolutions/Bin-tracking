// In production this is the same domain as the marketing site (the app's
// build is served from /app/* — see root netlify.toml), so this is mostly
// a same-origin navigation. In local dev it's a genuinely different origin
// (marketing on 3002, app on 3000). Either way the handoff mechanism below
// works unchanged. Set VITE_APP_URL before deploying; defaults to the local
// dev port.
export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

/**
 * Hands a freshly-created Supabase session off to the app. In local dev,
 * apps/web is a genuinely separate origin, so its session storage can't see
 * one created here — the access/refresh tokens are carried across in the
 * URL **hash** (never the query string, and never sent to a server or
 * included in Referer headers) for the app's /app/auth/callback route to
 * pick up and call supabase.auth.setSession() with. The app clears the hash
 * immediately after consuming it. (In production, where both apps share a
 * domain, the session is already visible via shared storage before this
 * navigation even happens — the hash tokens are redundant there but
 * harmless, and keep this working if the two apps are ever split onto
 * separate domains again later.)
 */
export function handoffToApp(accessToken: string, refreshToken: string): void {
    const hash = new URLSearchParams({ access_token: accessToken, refresh_token: refreshToken }).toString();
    window.location.href = `${APP_URL}/app/auth/callback#${hash}`;
}
