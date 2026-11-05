export const DIRECTIONS = ['BOTH', 'IN', 'OUT'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const DIRECTION_LABELS: Record<Direction, string> = {
    BOTH: 'IN + OUT (one card toggles)',
    IN: 'IN only',
    OUT: 'OUT only',
};
