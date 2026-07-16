/**
 * Central auth-bypass flag. DISABLE_AUTH=true is a dev/demo convenience
 * and is HARD-DISABLED in production regardless of env value.
 */
export function isAuthDisabled(): boolean {
    if (process.env['NODE_ENV'] === 'production') return false;
    return process.env['DISABLE_AUTH'] === 'true';
}
