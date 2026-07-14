"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/app/Logo";
import { Icon } from "@/components/ui/Icon";
import { LiveDot } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";

const marquee = ["Facility OS", "Vision AI", "Butcher Talk", "Blockchain Verified"];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login(email || "operator@nextphase.com");
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-olive-deep p-12 text-bone lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-rust/15 blur-3xl" />
        <Logo variant="light" className="relative h-9 w-auto" />
        <div className="relative">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-bone/20 bg-white/5 px-3 py-1.5">
            <LiveDot />
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-bone/70">Plant 01 · online</span>
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-bone">
            The whole plant,
            <br />
            online and proven.
          </h1>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-bone-light/80">
            Sign in to your facility operating system — live zones, voice capture, compliance, and
            recovery, all in one connected view.
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-bone/45">
          {marquee.map((m, i) => (
            <span key={m} className="flex items-center gap-4">
              {i > 0 && <span className="text-bone/25">·</span>}
              {m}
            </span>
          ))}
        </div>
      </aside>

      {/* Form */}
      <section className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-50 lg:hidden" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-md"
        >
          <Logo variant="dark" className="mb-8 h-8 w-auto lg:hidden" />
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-rust">Facility portal</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-olive-deep">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Access your live facility dashboard.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-olive-deep">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourplant.com"
                className="w-full rounded-xl border border-edge bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="pw" className="mb-1.5 block text-xs font-semibold text-olive-deep">Password</label>
              <div className="relative">
                <input
                  id="pw"
                  type={show ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-edge bg-white px-4 py-3 pr-12 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted hover:text-olive-deep"
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rust px-6 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-glow"
            >
              <Icon name="arrow" width={16} height={16} />
              Enter facility
            </button>
          </form>

          <p className="mt-6 rounded-xl border border-edge/70 bg-bone-light/50 p-3 text-center text-xs text-muted">
            Demo build — any email and password signs you in.
          </p>
        </motion.div>
      </section>
    </main>
  );
}
