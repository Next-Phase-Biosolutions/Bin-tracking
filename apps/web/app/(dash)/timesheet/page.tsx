"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, Stat, Reveal, LiveDot, Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { trpc, apiConfigured } from "@/lib/trpc";
import * as mock from "@/lib/data";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatHours = (mins: number) => `${Math.floor(mins / 60)}h ${pad(Math.round(mins % 60))}m`;

interface Row {
  id: string;
  name: string;
  department: string;
  sessions: number;
  minutes: number;
  openSession: boolean;
  qrCode?: string;
}

export default function TimesheetPage() {
  const today = new Date();
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [manualCode, setManualCode] = useState("");

  // Day range for the selected date (inclusive → [00:00, next 00:00))
  const range = useMemo(() => {
    const from = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [selected]);

  const utils = trpc.useUtils();
  const summaryQ = trpc.attendance.summary.useQuery(range, { enabled: apiConfigured, staleTime: 10_000 });
  const recentQ = trpc.attendance.recent.useQuery({ limit: 100 }, { enabled: apiConfigured, staleTime: 10_000 });
  const employeesQ = trpc.employee.list.useQuery({}, { enabled: apiConfigured, staleTime: 60_000 });
  const scan = trpc.attendance.scan.useMutation({
    onSuccess: () => {
      utils.attendance.summary.invalidate();
      utils.attendance.recent.invalidate();
      setManualCode("");
    },
  });

  const qrById = useMemo(() => {
    const m = new Map<string, string>();
    (employeesQ.data ?? []).forEach((e) => m.set(e.id, e.qrCode));
    return m;
  }, [employeesQ.data]);

  // Normalize rows (live vs mock)
  const rows: Row[] = apiConfigured
    ? (summaryQ.data ?? [])
        .filter((e) => e.sessionCount > 0)
        .map((e) => ({
          id: e.employeeId,
          name: e.fullName,
          department: e.department ?? "—",
          sessions: e.sessionCount,
          minutes: e.totalMinutes,
          openSession: e.openSession,
          qrCode: qrById.get(e.employeeId),
        }))
    : mock.timesheet.map((r) => ({
        id: r.id,
        name: r.name,
        department: r.department,
        sessions: r.sessions,
        minutes: Math.round(r.hours * 60),
        openSession: r.status === "On site",
      }));

  const scans = apiConfigured
    ? (recentQ.data ?? []).map((s) => ({
        id: s.id,
        name: s.employeeName,
        action: s.eventType === "CHECK_IN" ? "Check in" : "Check out",
        gate: s.source ?? "Gate",
        time: new Date(s.scannedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      }))
    : mock.recentScans;

  // Days with activity (dots on the calendar) from the recent-scan feed
  const activeDays = useMemo(() => {
    const s = new Set<string>();
    if (apiConfigured) (recentQ.data ?? []).forEach((e) => s.add(dateKey(new Date(e.scannedAt))));
    else s.add(dateKey(today));
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentQ.data]);

  const onSite = rows.filter((r) => r.openSession).length;
  const totalMinutes = rows.reduce((n, r) => n + r.minutes, 0);

  // Build the month grid
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const isSelected = (day: number) =>
    selected.getFullYear() === view.y && selected.getMonth() === view.m && selected.getDate() === day;
  const isToday = (day: number) =>
    today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === day;

  const toggleScan = (qrCode?: string) => {
    if (!qrCode || !apiConfigured) return;
    scan.mutate({ qrCode, source: "Timesheet" });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Timesheet Dashboard"
        subtitle="Hours by employee, built from gate scans through the day."
        icon={<Icon name="clock" width={22} height={22} />}
        actions={
          <>
            <Link href="/employees/register">
              <Button variant="secondary">
                <Icon name="users" width={15} height={15} />
                Employee Registration
              </Button>
            </Link>
            <Link href="/employee-scanner">
              <Button variant="primary">
                <Icon name="badge" width={15} height={15} />
                Scanner
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Reveal><Stat label="on_site_now" value={onSite} icon={<Icon name="users" width={18} height={18} />} /></Reveal>
        <Reveal delay={0.05}><Stat label="hours_selected_day" value={formatHours(totalMinutes)} icon={<Icon name="clock" width={18} height={18} />} /></Reveal>
        <Reveal delay={0.1}><Stat label="employees" value={rows.length} icon={<Icon name="badge" width={18} height={18} />} /></Reveal>
      </div>

      {/* Calendar + manual check-in */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-olive-deep">{MONTHS[view.m]} {view.y}</h2>
              <div className="flex items-center gap-1">
                <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded-lg border border-edge bg-white p-1.5 text-muted hover:bg-bone-light hover:text-olive-deep">
                  <Icon name="arrow" width={14} height={14} className="rotate-180" />
                </button>
                <button onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded-lg border border-edge bg-white p-1.5 text-muted hover:bg-bone-light hover:text-olive-deep">
                  <Icon name="arrow" width={14} height={14} />
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-1 text-center font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted">{w}</div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} />;
                const key = `${view.y}-${pad(view.m + 1)}-${pad(day)}`;
                const active = activeDays.has(key);
                const sel = isSelected(day);
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(new Date(view.y, view.m, day))}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                      sel ? "bg-olive-deep text-bone-light" : "text-ink hover:bg-bone-light"
                    } ${isToday(day) && !sel ? "ring-1 ring-rust/50" : ""}`}
                  >
                    <span className={sel ? "font-bold" : ""}>{day}</span>
                    {active ? <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${sel ? "bg-rust-light" : "bg-rust"}`} /> : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 border-t border-edge/60 pt-3 text-xs text-muted">
              Showing <span className="font-semibold text-olive-deep">{selected.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
              {" "}· <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rust" /> has scans</span>
            </p>
          </Card>
        </Reveal>

        {/* Manual check-in + recent scans */}
        <div className="space-y-4">
          {apiConfigured ? (
            <Reveal>
              <Card className="p-5">
                <h2 className="font-display text-base font-bold text-olive-deep">Quick check-in / out</h2>
                <p className="mt-1 text-sm text-muted">Scan or type a badge code to toggle someone in or out.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && manualCode.trim() && toggleScan(manualCode.trim())}
                    placeholder="e.g. EMPQR-001"
                    className="min-w-0 flex-1 rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none"
                  />
                  <button
                    onClick={() => manualCode.trim() && toggleScan(manualCode.trim())}
                    disabled={!manualCode.trim() || scan.isPending}
                    className="shrink-0 rounded-xl bg-rust px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-rust/90 disabled:opacity-50"
                  >
                    Toggle
                  </button>
                </div>
                {scan.data ? (
                  <p className="mt-3 text-sm text-olive-deep">
                    <span className="font-semibold">{scan.data.employeeName}</span> — {scan.data.action === "CHECK_IN" ? "checked in" : "checked out"}.
                  </p>
                ) : null}
                {scan.error ? <p className="mt-3 text-sm text-rust">{scan.error.message}</p> : null}
              </Card>
            </Reveal>
          ) : null}

          <Reveal delay={0.05}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-olive-deep">Recent scans</h2>
                <span className="flex items-center gap-1.5 font-mono text-[0.56rem] uppercase tracking-[0.12em] text-live"><LiveDot /> live</span>
              </div>
              <ul className="mt-4 space-y-3">
                {scans.length === 0 ? <li className="text-sm text-muted">No scans yet.</li> : null}
                {scans.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${s.action === "Check in" ? "bg-live/15 text-live" : "bg-edge/30 text-muted"}`}>
                      <Icon name={s.action === "Check in" ? "arrow" : "logout"} width={14} height={14} />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-olive-deep">{s.name}</p>
                      <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted">{s.action} · {s.gate} · {s.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>

      {/* Hours by employee for the selected day */}
      <Reveal delay={0.05}>
        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-edge/60 p-5">
            <h2 className="font-display text-lg font-bold text-olive-deep">
              Hours — {selected.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </h2>
          </div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-left">
                  {["employee", "department", "sessions", "hours", "status", apiConfigured ? "action" : ""].filter(Boolean).map((h) => (
                    <th key={h} className="px-5 py-3 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted">No hours logged for this day.</td></tr>
                ) : null}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-edge/40 last:border-0 hover:bg-bone-light/40">
                    <td className="px-5 py-3 font-medium text-olive-deep">{r.name}</td>
                    <td className="px-5 py-3 text-muted">{r.department}</td>
                    <td className="px-5 py-3 tnum text-ink">{r.sessions}</td>
                    <td className="px-5 py-3 font-semibold text-olive-deep tnum">{formatHours(r.minutes)}</td>
                    <td className="px-5 py-3"><Badge tone={r.openSession ? "good" : "idle"}>{r.openSession ? "On site" : "Off site"}</Badge></td>
                    {apiConfigured ? (
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleScan(r.qrCode)}
                          disabled={!r.qrCode || scan.isPending}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                            r.openSession ? "border-edge bg-white text-muted hover:bg-bone-light" : "border-live/40 bg-live/[0.08] text-olive-deep hover:bg-live/[0.14]"
                          }`}
                        >
                          {r.openSession ? "Check out" : "Check in"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
