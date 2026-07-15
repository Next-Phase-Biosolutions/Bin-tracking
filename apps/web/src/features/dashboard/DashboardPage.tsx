
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Badge, Progress, Reveal, LiveDot, Button, SectionHead } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { CountValue, TickValue } from "@/components/app/LiveValue";
import {
  getWorkflowProgress,
  getActivityLog,
  getOpsCycles,
  getEnvironmental,
  getCarbon,
} from "@/lib/api";
import { useOpsMetrics, useFacilities } from "@/lib/live-data";

const filters = ["All Time", "2 Days", "7 Days", "Custom"];

export default function DashboardPage() {
  const [filter, setFilter] = useState("2 Days");
  const facilities = useFacilities();
  const progress = getWorkflowProgress();
  const metrics = useOpsMetrics();
  const cycles = getOpsCycles();
  const log = getActivityLog();
  const env = getEnvironmental();
  const carbon = getCarbon();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Facility Dashboard"
        subtitle="Daily workflow and operations, one unified view."
        icon={<Icon name="grid" width={22} height={22} />}
        actions={
          <>
            <div className="hidden items-center gap-1 rounded-full border border-edge bg-white p-1 sm:flex">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === f ? "bg-olive-deep text-bone-light" : "text-muted hover:text-olive-deep"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <Button variant="secondary">
              <Icon name="refresh" width={15} height={15} />
              Refresh
            </Button>
          </>
        }
      />

      {/* Top metrics: workflow + ops */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <Reveal>
          <Card className="relative h-full overflow-hidden p-6">
            <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-40" />
            <div className="relative flex items-center justify-between">
              <p className="kicker">workflow_progress</p>
              <span className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-live">
                <LiveDot /> live
              </span>
            </div>
            <p className="relative mt-3 font-display text-[2.4rem] font-extrabold leading-none tracking-tight text-olive-deep tnum">
              <CountValue value={progress} />%
            </p>
            <div className="relative mt-4">
              <Progress value={progress} />
            </div>
            <p className="relative mt-3 text-xs text-muted">3 of 6 zones cleared · processing active</p>
          </Card>
        </Reveal>
        {metrics.map((m, i) => (
          <Reveal key={m.label} delay={0.05 + i * 0.05}>
            <Card className="h-full p-6">
              <p className="kicker">{m.label}</p>
              <p className="mt-3 font-display text-[2rem] font-extrabold leading-none tracking-tight text-olive-deep tnum">
                <CountValue value={m.value} />
                {m.unit ? <span className="ml-0.5 text-base font-bold text-muted">{m.unit}</span> : null}
              </p>
              <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">
                {m.label === "overdue" ? "needs attention" : m.label === "compliance" ? "blockchain sealed" : "this period"}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* Zone status grid */}
      <SectionHead title="Facility Zones" className="mb-3 mt-8" right={<span className="kicker">live_tracking</span>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facilities.map((z, i) => {
          const card = (
            <Card className="group h-full p-6 transition-all hover:-translate-y-0.5 hover:shadow-panel-sm">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bone-light text-olive-deep">
                  <Icon name={z.icon} width={21} height={21} />
                </span>
                <Badge tone={z.status}>{z.status}</Badge>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-olive-deep">{z.name}</h3>
              <p className="mt-1 text-sm text-muted">{z.statusNote}</p>
              <div className="mt-4 flex items-center justify-between border-t border-edge/60 pt-3">
                <span className="kicker">{z.stat.label}</span>
                <span className="font-mono text-base font-semibold text-olive-deep">
                  {z.stat.value}
                  <span className="ml-1 text-xs font-normal text-muted">{z.stat.unit}</span>
                </span>
              </div>
            </Card>
          );
          return (
            <Reveal key={z.id} delay={i * 0.04}>
              {z.href ? <Link to={z.href}>{card}</Link> : card}
            </Reveal>
          );
        })}
      </div>

      {/* Lower: recovery cycles + activity/environment */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Recovery / byproduct cycles */}
        <Reveal>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/60 p-5">
              <div>
                <SectionHead title="Recovery Cycles" />
                <p className="mt-1 text-sm text-muted">Byproduct bins routed, sold, and recovered.</p>
              </div>
              <span className="kicker">live_tracking</span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-edge/40 sm:grid-cols-3">
              <div className="bg-white p-4">
                <p className="kicker">carbon_credits</p>
                <p className="mt-1 font-display text-xl font-extrabold text-olive-deep tnum">
                  <CountValue value={carbon.credits} /> <span className="text-sm text-muted">{carbon.unit}</span>
                </p>
              </div>
              <div className="bg-white p-4">
                <p className="kicker">recovered_revenue</p>
                <p className="mt-1 font-display text-xl font-extrabold text-olive-deep tnum">
                  $<CountValue value={carbon.revenue} />
                </p>
              </div>
              <div className="bg-white p-4">
                <p className="kicker">active_streams</p>
                <p className="mt-1 font-display text-xl font-extrabold text-olive-deep tnum">{cycles.length}</p>
              </div>
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge/60 text-left">
                    {["bin", "stream", "weight", "value", "status"].map((h) => (
                      <th key={h} className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id} className="border-b border-edge/40 last:border-0 hover:bg-bone-light/40">
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-olive-deep">{c.id}</span>
                      </td>
                      <td className="px-5 py-3 font-medium text-ink">{c.stream}</td>
                      <td className="px-5 py-3 text-muted tnum">{c.weight}</td>
                      <td className="px-5 py-3 font-semibold text-olive-deep tnum">{c.value}</td>
                      <td className="px-5 py-3">
                        <Badge tone={c.status.tone}>{c.status.label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>

        {/* Activity + environment */}
        <div className="space-y-4">
          <Reveal delay={0.05}>
            <Card className="p-6">
              <SectionHead title="Latest Activity" right={<span className="kicker">live_feed</span>} />
              <ul className="mt-4 space-y-3">
                {log.map((a, i) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex gap-3"
                  >
                    <span className="mt-1.5">
                      <LiveDot tone={a.tone === "rust" ? "rust" : a.tone === "muted" ? "muted" : "live"} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink/85">{a.text}</p>
                      <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">
                        {a.actor} · {a.time}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="relative overflow-hidden p-6">
              <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-40" />
              <div className="relative flex items-center justify-between">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-olive">environmental</p>
                <span className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-live">
                  <LiveDot /> stable
                </span>
              </div>
              <div className="relative mt-4 space-y-3">
                {env.map((e) => (
                  <div key={e.label} className="flex items-center justify-between border-b border-edge/60 pb-3 last:border-0 last:pb-0">
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-olive">{e.label}</span>
                    <span className="font-display text-lg font-bold text-olive-deep">
                      <TickValue base={e.value} unit={e.unit} decimals={e.decimals} />
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
