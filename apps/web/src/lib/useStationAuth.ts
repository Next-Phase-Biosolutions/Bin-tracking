import { useEffect } from 'react';
import { setStationToken } from './trpc';

const TABLET_STATION_TOKEN = import.meta.env.VITE_TEST_STATION_TOKEN || '';

/**
 * Marks the shared tRPC client as station-authenticated for the lifetime of
 * the calling kiosk page (guard scanner, shipment intake, farmer
 * registration, tablet form-fill). Reads the same test-station-token
 * convention TabletPage already uses. Real per-device station provisioning
 * is Phase 4 — this just keeps these flows from silently 401ing once
 * DISABLE_AUTH is turned off.
 */
export function useStationAuth(): void {
    useEffect(() => {
        setStationToken(TABLET_STATION_TOKEN);
        return () => setStationToken(null);
    }, []);
}
