/**
 * Device id rule shared by ingest, the admin API and the registration CLI.
 * Lives in `types` because `packages/db` (the CLI) depends on `types` but not on
 * `validators`. The id is NOT a secret: vendor ids are sequential, so this only
 * keeps ids safe to put in a JSON body, a log line or a URL.
 */
export const SENSOR_DEVICE_ID_MAX_LENGTH = 64;
export const SENSOR_DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** `null` when the (trimmed) id is valid, else a short human reason. */
export function sensorDeviceIdProblem(raw: string): string | null {
    const id = raw.trim();
    if (id.length === 0) return 'empty';
    if (id.length > SENSOR_DEVICE_ID_MAX_LENGTH) return `longer than ${SENSOR_DEVICE_ID_MAX_LENGTH} characters`;
    if (!SENSOR_DEVICE_ID_PATTERN.test(id)) return 'only letters, digits, "-" and "_" are allowed';
    return null;
}

/** Icons an admin can give a zone; every name exists in apps/web/src/components/ui/Icon.tsx. */
export const ZONE_ICON_NAMES = [
    'grid',
    'truck',
    'blade',
    'knife',
    'snow',
    'box',
    'ship',
    'thermo',
    'drop',
    'gas',
    'leaf',
    'bin',
    'cow',
    'bolt',
] as const;

export type ZoneIconName = (typeof ZONE_ICON_NAMES)[number];

/** Splits pasted text into ids on whitespace/commas/semicolons, de-duped in order. Does not validate. */
export function parseDeviceIdList(text: string): string[] {
    return [...new Set(text.split(/[\s,;]+/).filter(Boolean))];
}
