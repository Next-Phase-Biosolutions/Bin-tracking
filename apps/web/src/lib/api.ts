/**
 * Data access layer. Every screen imports from here, never from lib/data directly.
 * Swap these function bodies for real fetch() / backend calls and the UI is unchanged.
 */
import * as data from "./data";

export const getZones = () => data.zones;
export const getZone = (id: string) => data.zones.find((z) => z.id === id);

export const getWorkflowProgress = () => data.workflowProgress;
export const getActivityLog = () => data.activityLog;
export const getOpsMetrics = () => data.opsMetrics;
export const getOpsCycles = () => data.opsCycles;
export const getEnvironmental = () => data.environmental;
export const getCarbon = () => data.carbon;

export const getShipments = () => data.shipments;
export const getTimesheet = () => data.timesheet;
export const getRecentScans = () => data.recentScans;
export const getForms = () => data.forms;
export const getForm = (id: string) => data.forms.find((f) => f.id === id);
export const getLifecycleStages = () => data.lifecycleStages;

export type { Zone, ZoneRow, ZoneStat, ZoneEnv, ActivityItem, FormDef } from "./data";
