
import { useState, type FormEvent } from "react";

const field =
  "w-full rounded-xl border border-edge bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none";

// The facility app lives at its own URL. Set VITE_APP_URL to the app domain
// (e.g. https://app.nextphasebiosolutions.com) before deploying; defaults to local app port.
const APP_URL = import.meta.env.VITE_APP_URL || "http://localhost:4174";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = (new FormData(e.currentTarget).get("email") as string) || "operator@nextphase.com";
    // Hand off to the facility app, which auto-enters from the portal (single sign in).
    window.location.href = `${APP_URL}/?u=${encodeURIComponent(email)}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-olive-deep">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourplant.com"
          className={field}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="block text-xs font-semibold text-olive-deep">
            Password
          </label>
          <a href="#" className="text-xs font-medium text-rust underline-offset-4 hover:underline">
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            className={`${field} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted hover:text-olive-deep"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="remember" className="h-4 w-4 rounded border-edge accent-rust" />
        Keep me signed in
      </label>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rust px-6 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgba(168,68,42,0.75)]"
      >
        Sign in
      </button>
    </form>
  );
}
