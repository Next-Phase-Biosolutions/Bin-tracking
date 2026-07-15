
import { useState, type FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const field =
  "w-full rounded-xl border border-edge bg-canvas px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-rust focus:outline-none";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(data as unknown as Record<string, string>).toString(),
      });
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-edge bg-canvas p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-olive/15 text-olive">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h3 className="mt-4 font-display text-xl font-bold text-olive-deep">Request received</h3>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Thank you. Our team will reach out to schedule your walkthrough. You can
          also email us directly at info@nextphasebiosolutions.com.
        </p>
      </div>
    );
  }

  return (
    <form
      name="walkthrough"
      method="POST"
      data-netlify="true"
      netlify-honeypot="company-website"
      onSubmit={handleSubmit}
      className="rounded-2xl border border-edge bg-white p-6 shadow-panel-sm md:p-7"
    >
      <input type="hidden" name="form-name" value="walkthrough" />
      <p hidden>
        <label>
          Do not fill this out: <input name="company-website" />
        </label>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-semibold text-olive-deep">
            Name
          </label>
          <input id="name" name="name" required autoComplete="name" placeholder="Jordan Mills" className={field} />
        </div>
        <div>
          <label htmlFor="company" className="mb-1.5 block text-xs font-semibold text-olive-deep">
            Company
          </label>
          <input id="company" name="company" required autoComplete="organization" placeholder="Hillcrest Meats" className={field} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-olive-deep">
            Work email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="jordan@hillcrest.com" className={field} />
        </div>
        <div>
          <label htmlFor="role" className="mb-1.5 block text-xs font-semibold text-olive-deep">
            Role
          </label>
          <input id="role" name="role" autoComplete="organization-title" placeholder="Plant manager" className={field} />
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor="message" className="mb-1.5 block text-xs font-semibold text-olive-deep">
          What would you like to see?
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Tell us about your operation: species, throughput, and where you think the money is leaking."
          className={field}
        />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-rust px-6 py-3.5 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgba(168,68,42,0.75)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {status === "submitting" ? "Sending…" : "Book a walkthrough"}
      </button>

      {status === "error" && (
        <p className="mt-3 text-sm text-rust">
          Something went wrong sending your request. Please email
          info@nextphasebiosolutions.com directly.
        </p>
      )}
    </form>
  );
}
