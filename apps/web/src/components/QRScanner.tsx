import { useState, useRef, useEffect } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface QRScannerProps {
    onScan: (decodedText: string) => void;
    onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        // Initialize scanner
        scannerRef.current = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
                rememberLastUsedCamera: true,
                aspectRatio: 1.0,
            },
            /* verbose= */ false
        );

        scannerRef.current.render(
            (decodedText) => {
                onScan(decodedText);
            },
            (errorMessage) => {
                if (onError) {
                    onError(errorMessage);
                }
            }
        );

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
        };
    }, [onScan, onError]);

    return (
        <div className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border-2 border-[#BCD19B]/30 shadow-lg relative bg-black/5">
            <div id="reader" className="w-full"></div>

            <style>{`
                #reader { border: none !important; }
                #reader button {
                    background-color: #3d5aa8;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 9999px;
                    font-weight: 600;
                    margin: 10px 0;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                #reader button:hover { background-color: #2d4280; }
                #reader__dashboard_section_csr span { color: #043F2E !important; font-weight: 600; }
                #reader select {
                    padding: 8px;
                    border-radius: 8px;
                    border: 1px solid #ccc;
                    margin: 10px 0;
                    width: 90%;
                    max-width: 300px;
                }
            `}</style>
        </div>
    );
}
