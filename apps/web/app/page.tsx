"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, ready, login } = useAuth();

  useEffect(() => {
    if (!ready) return;
    // Arriving from the marketing login portal: auto-enter (single sign in).
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) {
      login(decodeURIComponent(u)); // writes localStorage synchronously
      window.location.replace("/app/dashboard/");
      return;
    }
    // Hard navigation (not router.replace): App-Router client nav stalls when proxied
    // across a rewrite to a different Netlify site. A plain browser load is bulletproof.
    window.location.replace(user ? "/app/dashboard/" : "/app/login/");
  }, [ready, user, login]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
    </div>
  );
}
