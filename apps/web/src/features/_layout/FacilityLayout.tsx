import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/app/Sidebar";
import { TopBar } from "@/components/app/TopBar";
import { VoiceBar } from "@/components/app/VoiceBar";
import { BlockchainModal } from "@/components/app/BlockchainModal";

export function FacilityLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (ready && !user) navigate("/login", { replace: true });
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex items-center gap-3 text-muted">
          <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
          <span className="font-mono text-xs uppercase tracking-[0.16em]">Loading facility…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              className="fixed inset-0 z-40 bg-olive-deep/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
            >
              <Sidebar onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-h-screen flex-col">
        <TopBar onMenu={() => setDrawer(true)} />
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </main>
      </div>

      <VoiceBar />
      <BlockchainModal />
    </div>
  );
}
