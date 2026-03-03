import { useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

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
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                if (onError) onError(msg);
                console.error('QR Scanner failed to start:', msg);
            });

        return () => {
            const s = scannerRef.current;
            if (s) {
                s.stop().then(() => s.clear()).catch(() => { });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border-2 border-[#BCD19B]/30 shadow-lg relative bg-black/5">
            <div id={containerId} className="w-full" />
        </div>
    );
}
