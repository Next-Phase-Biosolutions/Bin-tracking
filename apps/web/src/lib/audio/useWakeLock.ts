import { useEffect } from 'react';

/**
 * Holds a screen wake lock while mounted.
 *
 * Without this, hands-free recording fails in ordinary use: Android screen timeout
 * is commonly 30s-2min, and once the screen sleeps the page is throttled, the media
 * session is lost, and the headset button stops working.
 *
 * The lock is dropped automatically whenever the tab is hidden and is NOT restored
 * on its own, so it has to be re-acquired on visibilitychange.
 *
 * Does not help if the device is pocketed or manually locked — it prevents the
 * timeout case, which is the common one.
 */

interface WakeLockSentinelLike {
    release(): Promise<void>;
}

type WakeLockNavigator = Navigator & {
    wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
};

export function useWakeLock(): void {
    useEffect(() => {
        const wakeLock = (navigator as WakeLockNavigator).wakeLock;
        if (!wakeLock) return;

        let sentinel: WakeLockSentinelLike | null = null;
        let released = false;

        const acquire = async () => {
            if (released || document.visibilityState !== 'visible') return;
            try {
                sentinel = await wakeLock.request('screen');
            } catch {
                // Refused (low battery, or the tab lost visibility mid-request).
                // Nothing to do but let the screen behave normally.
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') void acquire();
        };

        void acquire();
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            released = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            void sentinel?.release().catch(() => {});
            sentinel = null;
        };
    }, []);
}
