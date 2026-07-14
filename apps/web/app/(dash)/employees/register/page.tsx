"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { trpc, apiConfigured } from "@/lib/trpc";

/** Deterministic faux-QR from a seed string. */
function FauxQR({ seed, size = 21 }: { seed: string; size?: number }) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const cell = 8;
  const cells: JSX.Element[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h = Math.imul(h ^ (x * 31 + y * 17), 16777619);
      const on = (h >>> 24) % 2 === 0;
      // finder squares in corners
      const finder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      if (finder ? (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5)) : on) {
        cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} rx={1} />);
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${size * cell} ${size * cell}`} className="h-40 w-40" fill="#3A3F2A" aria-label="employee QR badge">
      {cells}
    </svg>
  );
}

const depts = ["Kill Floor", "Processing", "Receiving", "Wet Aging", "Value Add", "Shipping"];

export default function EmployeeRegisterPage() {
  const [name, setName] = useState("");
  const [dept, setDept] = useState(depts[0]);
  const [role, setRole] = useState("");
  const [mockDone, setMockDone] = useState(false);
  const [mockId, setMockId] = useState("");

  const register = trpc.employee.register.useMutation();

  const submit = () => {
    if (apiConfigured) {
      register.mutate({ fullName: name, department: dept, position: role || undefined });
    } else {
      setMockId("EMP-" + Math.floor(1000 + Math.random() * 8999));
      setMockDone(true);
    }
  };
  const reset = () => {
    if (apiConfigured) register.reset();
    setMockDone(false);
    setName("");
    setRole("");
  };

  const done = apiConfigured ? register.isSuccess : mockDone;
  const submitting = apiConfigured && register.isPending;

  if (done) {
    const emp = register.data;
    const id = emp?.employeeCode ?? mockId;
    const qrSeed = emp?.qrCode ?? name + id;
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <h1 className="font-display text-2xl font-extrabold text-olive-deep">Badge generated</h1>
        <p className="mt-1 text-sm text-muted">Print or send this QR to the new employee.</p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mt-6 p-7">
            <div className="mx-auto w-fit rounded-2xl border border-edge bg-white p-4">
              <FauxQR seed={qrSeed} />
            </div>
            <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">{id}</p>
            <h2 className="font-display text-xl font-extrabold text-olive-deep">{emp?.fullName || name || "New Employee"}</h2>
            <p className="text-sm text-muted">{emp?.position || role || "Operator"} · {emp?.department || dept}</p>
          </Card>
        </motion.div>
        <button onClick={reset} className="mt-6 inline-flex rounded-xl border border-edge bg-white px-5 py-2.5 text-sm font-semibold text-olive-deep hover:bg-bone-light">
          Register another
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Employee Registration"
        subtitle="Add an employee and generate their gate QR badge."
        icon={<Icon name="users" width={22} height={22} />}
        actions={
          <>
            <Link href="/timesheet">
              <Button variant="secondary">
                <Icon name="clock" width={15} height={15} />
                Timesheet
              </Button>
            </Link>
            <Link href="/employee-scanner">
              <Button variant="secondary">
                <Icon name="badge" width={15} height={15} />
                Scanner
              </Button>
            </Link>
          </>
        }
      />
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-olive-deep">Full name <span className="text-rust">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan Doe" className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-olive-deep">Department</label>
              <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none">
                {depts.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-olive-deep">Role</label>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Line operator" className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm focus:border-rust focus:outline-none" />
            </div>
          </div>
        </div>
        <button onClick={submit} disabled={!name || submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-rust px-4 py-3 text-sm font-semibold text-canvas hover:bg-rust/90 disabled:opacity-50">
          <Icon name="badge" width={16} height={16} />
          {submitting ? "Registering…" : "Register & Generate QR"}
        </button>
        {apiConfigured && register.error ? (
          <p className="mt-3 text-center text-sm text-rust">{register.error.message}</p>
        ) : null}
      </Card>
    </div>
  );
}
