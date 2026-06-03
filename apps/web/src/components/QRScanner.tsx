import { useRef, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface QRScannerProps {
    onScan: (decodedText: string) => void;
    onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = 'qr-reader';

    useEffect(() => {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        // Under React StrictMode the effect runs twice (mount, unmount, mount).
        // start() is async, so the first instance can resolve AFTER its cleanup
        // ran and attach a second camera feed. This flag lets us stop a stream
        // that finished starting after the effect was torn down.
        let cancelled = false;

        const teardown = (s: Html5Qrcode) => {
            try {
                const state = s.getState();
                if (
                    state === Html5QrcodeScannerState.SCANNING ||
                    state === Html5QrcodeScannerState.PAUSED
                ) {
                    s.stop().then(() => s.clear()).catch(() => { });
                } else {
                    s.clear();
                }
            } catch {
                // Scanner had not started — nothing to tear down.
            }
        };

        scanner
            .start(
                // Always use the rear-facing camera — prevents all cameras on multi-camera phones
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    onScan(decodedText);
                },
                (_errorMessage) => {
                    // Scan errors fire every frame when no QR is visible — intentionally silenced
                }
            )
            .then(() => {
                // Effect was already cleaned up before the camera finished starting.
                if (cancelled) teardown(scanner);
            })
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                if (onError) onError(msg);
                console.error('QR Scanner failed to start:', msg);
            });

        return () => {
            cancelled = true;
            teardown(scanner);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border-2 border-[#BCD19B]/30 shadow-lg relative bg-black/5">
            <div id={containerId} className="w-full" />
        </div>
    );
}
