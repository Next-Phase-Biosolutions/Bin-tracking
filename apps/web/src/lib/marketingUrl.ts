// The public marketing site is where login/signup actually live — this app
// only has post-auth screens. Set VITE_MARKETING_URL to the marketing
// domain (e.g. https://nextphasebiosolutions.com) before deploying;
// defaults to the local dev port.
export const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || 'http://localhost:3002';
