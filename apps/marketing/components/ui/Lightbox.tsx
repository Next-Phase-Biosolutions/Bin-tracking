"use client";

import Image from "next/image";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EmissionsJourney } from "../dashboard/EmissionsJourney";

export type ZoomItem =
  | { kind: "image"; src: string; alt: string }
  | { kind: "emissions"; alt: string };

export function Lightbox({
  item,
  onClose,
}: {
  item: ZoomItem | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={item.alt}
        >
          <div className="absolute inset-0 bg-olive-deep/85 backdrop-blur-sm" />

          <motion.div
            className="relative z-10"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.21, 0.5, 0.27, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {item.kind === "image" ? (
              <Image
                src={item.src}
                alt={item.alt}
                width={1917}
                height={909}
                className="h-auto max-h-[84vh] w-auto max-w-[92vw] rounded-xl border border-bone/20 shadow-panel"
              />
            ) : (
              <div className="emissions-zoom overflow-hidden rounded-xl border border-edge bg-white shadow-panel">
                <div style={{ width: 560, height: 267 }}>
                  <EmissionsJourney />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute -right-3 -top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-rust text-canvas shadow-panel-sm transition-colors hover:bg-rust/90"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <p className="mt-3 text-center font-mono text-[0.64rem] uppercase tracking-[0.14em] text-bone/70">
              {item.alt}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
