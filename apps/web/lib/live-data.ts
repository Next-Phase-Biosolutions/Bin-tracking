"use client";

import { trpc, apiConfigured } from "./trpc";
import * as mock from "./data";
import type { ZoneStatus } from "./data";

/**
 * Live-data hooks. Each returns real data from the API's tRPC procedures when
 * NEXT_PUBLIC_API_URL is set (and the query resolves), and falls back to the mock
 * data otherwise, so the app still works with no backend. Extend this file with one
 * hook per screen as we wire them.
 */

/** Ops metric cards ← dashboard.stats */
export function useOpsMetrics() {
  const q = trpc.dashboard.stats.useQuery(undefined, { enabled: apiConfigured });
  if (apiConfigured && q.data) {
    const s = q.data;
    return [
      { label: "active_bins", value: s.totalActiveBins, unit: "" },
      { label: "overdue", value: s.totalOverdue, unit: "" },
      { label: "done_today", value: s.totalCompletedToday, unit: "" },
      { label: "compliance", value: s.complianceRate, unit: "%" },
    ];
  }
  return mock.opsMetrics;
}

export interface FacilityCard {
  id: string;
  name: string;
  icon: string;
  status: ZoneStatus;
  statusNote: string;
  stat: { label: string; value: string; unit: string };
  href: string | null;
}

/** Facility grid ← dashboard.stats.byFacility (real facilities + live bin counts) */
export function useFacilities(): FacilityCard[] {
  const q = trpc.dashboard.stats.useQuery(undefined, { enabled: apiConfigured });
  if (apiConfigured && q.data) {
    return q.data.byFacility.map((f) => ({
      id: f.facilityId,
      name: f.facilityName,
      icon: "box",
      status: (f.overdueBins > 0 ? "pending" : f.activeBins > 0 ? "active" : "idle") as ZoneStatus,
      statusNote: `${f.activeBins} active bins`,
      stat: { label: "overdue_bins", value: String(f.overdueBins), unit: "" },
      href: null, // facility detail view is a separate product decision (zones rework)
    }));
  }
  return mock.zones.map((z) => ({
    id: z.id,
    name: z.name,
    icon: z.icon,
    status: z.status,
    statusNote: z.statusNote,
    stat: { label: z.stats[0].label, value: z.stats[0].value, unit: z.stats[0].unit ?? "" },
    href: `/zones/${z.id}`,
  }));
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
function shortDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function shortTime(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Supplier shipments ← shipment.list */
export function useShipments() {
  const q = trpc.shipment.list.useQuery({}, { enabled: apiConfigured });
  if (apiConfigured && q.data) {
    return q.data.map((s) => ({
      id: s.shipmentCode,
      ref: s.reference ?? "—",
      supplier: s.supplier,
      facility: s.facilityName ?? "—",
      qty: s.quantity ?? 0,
      received: shortDate(s.receivedAt),
      condition: s.condition === "GOOD" ? "Good" : titleCase(s.condition),
    }));
  }
  return mock.shipments;
}

/** Timesheet rows + recent scan feed ← attendance.summary / attendance.recent */
export function useTimesheet() {
  const summaryQ = trpc.attendance.summary.useQuery({}, { enabled: apiConfigured });
  const recentQ = trpc.attendance.recent.useQuery({}, { enabled: apiConfigured });
  const live = apiConfigured && summaryQ.data && recentQ.data;
  if (live) {
    const rows = summaryQ.data!.map((e) => ({
      id: e.employeeId,
      name: e.fullName,
      department: e.department ?? "—",
      sessions: e.sessionCount,
      hours: e.totalMinutes / 60,
      status: e.openSession ? "On site" : "Off site",
    }));
    const scans = recentQ.data!.map((s) => ({
      id: s.id,
      name: s.employeeName,
      action: s.eventType === "CHECK_IN" ? "Check in" : "Check out",
      gate: titleCase(s.source ?? ""),
      time: shortTime(s.scannedAt),
    }));
    return { rows, scans };
  }
  return { rows: mock.timesheet, scans: mock.recentScans };
}

// Friendly type labels matching the legacy app's Forms list.
const FORM_TYPE_LABEL: Record<string, string> = {
  standard: "Multi-Section",
  checklist: "Checklist",
  matrix: "Matrix / Grid",
  repeating: "Repeating Table",
};

function countFormFields(schema: unknown): number {
  if (!schema || typeof schema !== "object") return 0;
  const s = schema as any;
  switch (s.formType) {
    case "standard":
      return (s.sections ?? []).reduce((n: number, sec: any) => n + (sec.fields?.length ?? 0) + (sec.tableColumns?.length ?? 0), 0);
    case "checklist":
      return (s.headerFields?.length ?? 0) + (s.groups ?? []).reduce((n: number, g: any) => n + (g.items?.length ?? 0), 0);
    case "matrix":
      return (s.headerFields?.length ?? 0) + (s.rows?.length ?? 0) * (s.columns?.length ?? 0) + (s.footerFields?.length ?? 0);
    case "repeating":
      return s.columns?.length ?? 0;
    default:
      if (Array.isArray(s.fields)) return s.fields.length;
      if (Array.isArray(s.sections)) return (s.sections as any[]).reduce((n, sec) => n + (sec.fields?.length ?? 0), 0);
      return 0;
  }
}

/** Forms list ← form.adminList */
export function useForms() {
  const q = trpc.form.adminList.useQuery(undefined, { enabled: apiConfigured });
  if (apiConfigured && q.data) {
    return q.data.map((f) => ({
      id: f.id,
      name: f.title,
      type: FORM_TYPE_LABEL[f.formType] ?? titleCase(f.formType),
      desc: f.description ?? "",
      fields: countFormFields(f.schema),
    }));
  }
  return mock.forms;
}
