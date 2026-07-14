"use client";

import { useEffect, useId, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

/**
 * Real webcam QR scanner. `html5-qrcode` is dynamically imported inside the effect so it never
 * runs during SSR/build (it touches the DOM at import time). Ported from the legacy Vite
 * QRScanner, with a unique container id so multiple scanners can't collide.
 */
export function CameraScanner({
  onScan,
  onError,
}: {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}) {
  const rawId = useId();
  const containerId = "qr-" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    const teardown = (s: Html5Qrcode) => {
      s.stop()
        .then(() => s.clear())
        .catch(() => {
          try {
            s.clear();
          } catch {
            /* not started — nothing to tear down */
          }
        });
    };

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode(containerId);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => onScan(decodedText),
          () => {
            /* per-frame "no QR" errors fire constantly — intentionally silenced */
          },
        );
        if (cancelled) {
          teardown(scanner);
          return;
        }
        setStatus("scanning");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!cancelled) {
          setStatus("error");
          onError?.(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) teardown(scanner);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-edge bg-black/5">
        <div id={containerId} className="w-full [&_video]:w-full" />
        {status !== "scanning" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {status === "starting" ? (
              <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                <span className="h-2 w-2 animate-blink rounded-full bg-rust" /> starting camera…
              </span>
            ) : (
              <span className="rounded-full bg-white/90 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-rust">
                camera unavailable
              </span>
            )}
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Point the camera at a QR code — it scans automatically.</p>
    </div>
  );
}
