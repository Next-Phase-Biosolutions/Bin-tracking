/**
 * Mock data for the Facility Zones tabs, ported verbatim from the original
 * design mockup (YonisY/nextphase-biosolutions-test) — presentation only,
 * no backend table or router behind it.
 */

export type ZoneStatus = 'complete' | 'active' | 'idle' | 'pending';

export interface ZoneStat {
    label: string;
    value: string;
    unit?: string;
    sub?: string;
}

export interface ZoneRow {
    id: string;
    title: string;
    subtitle: string;
    status: { label: string; tone: 'complete' | 'active' | 'idle' | 'pending' | 'good' | 'warn' | 'alert' };
    metrics: { label: string; value: string }[];
}

export interface ZoneEnv {
    label: string;
    value: number;
    unit: string;
    decimals?: number;
    tone?: 'live' | 'warn' | 'rust';
}

export interface Zone {
    id: string;
    name: string;
    icon: string;
    status: ZoneStatus;
    statusNote: string;
    tagline: string;
    listTitle: string;
    stats: ZoneStat[];
    rows: ZoneRow[];
    actions: string[];
    env: ZoneEnv[];
    envStable: boolean;
}

export const zones: Zone[] = [
    {
        id: 'receiving',
        name: 'Receiving',
        icon: 'truck',
        status: 'complete',
        statusNote: 'Intake 120 lots',
        tagline: 'Inbound trucks, manifests, and intake',
        listTitle: 'Active Deliveries',
        stats: [
            { label: 'dock_status', value: '3', unit: 'Active Docks' },
            { label: 'expected_deliveries', value: '8', unit: 'Trailers Today' },
            { label: 'daily_intake', value: '140', unit: 'Total Units' },
        ],
        rows: [
            {
                id: 'TRK-88',
                title: 'Truck #88',
                subtitle: 'North Plains Ranching',
                status: { label: 'Intake in progress', tone: 'active' },
                metrics: [
                    { label: 'units_logged', value: '40 / 120' },
                    { label: 'dock_assignment', value: 'DOCK-04' },
                ],
            },
            {
                id: 'TRK-92',
                title: 'Truck #92',
                subtitle: 'Heritage Valley Farms',
                status: { label: 'Awaiting dock', tone: 'pending' },
                metrics: [
                    { label: 'manifest_units', value: '60 Units' },
                    { label: 'arrival_time', value: '08:14 AM' },
                ],
            },
        ],
        actions: ['Log Incoming Lot', 'Verify manifest', 'Update inventory'],
        env: [
            { label: 'ambient_temp', value: 4.2, unit: '°C', decimals: 1 },
            { label: 'humidity', value: 84, unit: '%', decimals: 0 },
        ],
        envStable: true,
    },
    {
        id: 'killfloor',
        name: 'Kill Floor',
        icon: 'blade',
        status: 'complete',
        statusNote: 'Cleared 14:30',
        tagline: 'Slaughter line throughput and PPE safety',
        listTitle: 'Active Stations',
        stats: [
            { label: 'line_speed', value: '62', unit: 'head / hr' },
            { label: 'carcasses_today', value: '486', unit: 'Processed' },
            { label: 'ppe_compliance', value: '100', unit: '% Clear' },
        ],
        rows: [
            {
                id: 'ST-1',
                title: 'Stun & Bleed',
                subtitle: 'Station 1 · J. Doe',
                status: { label: 'Running', tone: 'active' },
                metrics: [
                    { label: 'rate', value: '62 / hr' },
                    { label: 'vision_qc', value: 'Pass' },
                ],
            },
            {
                id: 'ST-2',
                title: 'Evisceration',
                subtitle: 'Station 2 · M. Smith',
                status: { label: 'PPE alert cleared', tone: 'good' },
                metrics: [
                    { label: 'yield_vs_spec', value: '98.1%' },
                    { label: 'ppe', value: 'Compliant' },
                ],
            },
        ],
        actions: ['Flag Defect', 'Sanitation Log', 'Pause Line'],
        env: [
            { label: 'floor_temp', value: 11.4, unit: '°C', decimals: 1 },
            { label: 'humidity', value: 71, unit: '%', decimals: 0 },
        ],
        envStable: true,
    },
    {
        id: 'processing',
        name: 'Processing',
        icon: 'knife',
        status: 'active',
        statusNote: '42 units pending',
        tagline: 'Cut lines, yield against spec, and grading',
        listTitle: 'Active Cut Lines',
        stats: [
            { label: 'units_pending', value: '42', unit: 'in queue' },
            { label: 'yield_vs_spec', value: '92.4', unit: '%' },
            { label: 'cut_lines', value: '3', unit: 'Running' },
        ],
        rows: [
            {
                id: 'LINE-1',
                title: 'Line 1 — Primal Cuts',
                subtitle: 'Beef · AAA spec',
                status: { label: 'Active', tone: 'active' },
                metrics: [
                    { label: 'yield', value: '92.4%' },
                    { label: 'defects', value: '2 flagged' },
                ],
            },
            {
                id: 'LINE-2',
                title: 'Line 2 — Boning',
                subtitle: 'Pork · standard',
                status: { label: 'Active', tone: 'active' },
                metrics: [
                    { label: 'yield', value: '90.8%' },
                    { label: 'throughput', value: '318 / hr' },
                ],
            },
        ],
        actions: ['Reassign Cut', 'Yield Report', 'Flag Foreign Material'],
        env: [
            { label: 'room_temp', value: 6.1, unit: '°C', decimals: 1 },
            { label: 'humidity', value: 78, unit: '%', decimals: 0 },
        ],
        envStable: true,
    },
    {
        id: 'wetaging',
        name: 'Wet Aging',
        icon: 'snow',
        status: 'pending',
        statusNote: 'Awaiting Batch 4B',
        tagline: 'Cooler racks, aging time, and atmosphere',
        listTitle: 'Active Racks',
        stats: [
            { label: 'cooler_capacity', value: '78', unit: '%' },
            { label: 'avg_aging_time', value: '14', unit: 'Days' },
            { label: 'critical_alerts', value: '0', unit: 'Nominal' },
        ],
        rows: [
            {
                id: 'LOT-A101',
                title: 'Lot A-101',
                subtitle: 'T-Bone Select',
                status: { label: 'Ready soon', tone: 'good' },
                metrics: [
                    { label: 'age', value: 'Day 12' },
                    { label: 'units', value: '120' },
                ],
            },
            {
                id: 'LOT-B202',
                title: 'Lot B-202',
                subtitle: 'Ribeye Prime',
                status: { label: 'Aging start', tone: 'idle' },
                metrics: [
                    { label: 'age', value: 'Day 4' },
                    { label: 'units', value: '85' },
                ],
            },
        ],
        actions: ['Move to Value Add', 'Temp Log Override', 'Inventory Audit'],
        env: [
            { label: 'temperature', value: 34.2, unit: '°F', decimals: 1 },
            { label: 'humidity', value: 85, unit: '%', decimals: 0 },
            { label: 'co2_levels', value: 412, unit: 'ppm', decimals: 0 },
        ],
        envStable: true,
    },
    {
        id: 'valueadd',
        name: 'Value Add',
        icon: 'box',
        status: 'idle',
        statusNote: 'Scheduled 16:00',
        tagline: 'Prep projects, marination, and custom cuts',
        listTitle: 'Current Projects',
        stats: [
            { label: 'prep_quota', value: '65', unit: '%' },
            { label: 'active_staff', value: '08', unit: '5 / 6 manned' },
            { label: 'prep_stations', value: '06', unit: 'Operational' },
        ],
        rows: [
            {
                id: 'BATCH-12',
                title: 'Marination Batch',
                subtitle: 'Batch #12 · 50 units',
                status: { label: 'Active', tone: 'active' },
                metrics: [
                    { label: 'soak_time', value: '02:45:00' },
                    { label: 'station', value: 'S-04_B' },
                ],
            },
            {
                id: 'ORDER-77',
                title: 'Custom Cuts',
                subtitle: 'Order #77 · 12 units',
                status: { label: 'Priority', tone: 'pending' },
                metrics: [
                    { label: 'station', value: 'S-04_B' },
                    { label: 'due', value: '16:00' },
                ],
            },
        ],
        actions: ['Start New Project', 'Label Printing', 'Waste Log'],
        env: [
            { label: 'zone_temp', value: 4.2, unit: '°C', decimals: 1 },
            { label: 'station_humidity', value: 82, unit: '%', decimals: 0 },
        ],
        envStable: true,
    },
    {
        id: 'shipping',
        name: 'Shipping',
        icon: 'ship',
        status: 'idle',
        statusNote: 'Bay 1 available',
        tagline: 'Outbound loads, manifests, and dispatch',
        listTitle: 'Outbound Loads',
        stats: [
            { label: 'open_bays', value: '2', unit: 'Available' },
            { label: 'loads_today', value: '5', unit: 'Dispatched' },
            { label: 'on_time_rate', value: '98', unit: '%' },
        ],
        rows: [
            {
                id: 'LOAD-31',
                title: 'Load #31 — Great Lakes',
                subtitle: 'Bay 2 · 18 pallets',
                status: { label: 'Loading', tone: 'active' },
                metrics: [
                    { label: 'manifest', value: 'Sealed' },
                    { label: 'depart', value: '15:30' },
                ],
            },
            {
                id: 'LOAD-32',
                title: 'Load #32 — Chicago Co.',
                subtitle: 'Bay 1 · staged',
                status: { label: 'Staged', tone: 'idle' },
                metrics: [
                    { label: 'pallets', value: '12' },
                    { label: 'depart', value: '17:00' },
                ],
            },
        ],
        actions: ['Seal Manifest', 'Assign Bay', 'Print BOL'],
        env: [
            { label: 'dock_temp', value: 5.8, unit: '°C', decimals: 1 },
            { label: 'humidity', value: 74, unit: '%', decimals: 0 },
        ],
        envStable: true,
    },
];

export const getZone = (id: string): Zone | undefined => zones.find((z) => z.id === id);
