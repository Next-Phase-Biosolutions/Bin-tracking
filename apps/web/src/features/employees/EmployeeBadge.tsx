import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { motion } from 'motion/react';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/primitives';

/**
 * The printable employee badge: QR (tablet/phone scanners) plus a Code 128
 * barcode (handheld scanners, e.g. Inateck BCST-70) of the same token.
 *
 * Extracted from EmployeeRegisterPage so the Employees dashboard can reprint a
 * badge without re-registering the person — losing a badge used to mean
 * creating a duplicate employee record.
 */

/** Only the fields the badge renders — works with any employee-shaped row. */
export interface BadgeEmployee {
    fullName: string;
    employeeCode: string;
    qrCode: string;
}

interface EmployeeBadgeProps {
    employee: BadgeEmployee;
    /** Optional footer action, e.g. "Register another employee". */
    footer?: React.ReactNode;
    /** Success banner shown straight after registration. */
    showSuccessBanner?: boolean;
}

export function EmployeeBadge({ employee, footer, showSuccessBanner = false }: EmployeeBadgeProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [qrError, setQrError] = useState<string | null>(null);
    const barcodeRef = useRef<HTMLCanvasElement | null>(null);
    const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        QRCode.toDataURL(employee.qrCode, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
            .then((url) => {
                if (active) setQrDataUrl(url);
            })
            .catch((err: unknown) => {
                if (active) setQrError(err instanceof Error ? err.message : 'Failed to render QR');
            });
        return () => {
            active = false;
        };
    }, [employee.qrCode]);

    // Render the same token as a Code 128 1D barcode for handheld scanners.
    useEffect(() => {
        if (!barcodeRef.current) return;
        try {
            JsBarcode(barcodeRef.current, employee.qrCode, {
                format: 'CODE128',
                displayValue: true,
                fontSize: 14,
                height: 70,
                margin: 10,
                width: 2,
            });
            setBarcodeDataUrl(barcodeRef.current.toDataURL('image/png'));
        } catch {
            setBarcodeDataUrl(null);
        }
    }, [employee.qrCode]);

    const handlePrint = () => {
        if (!qrDataUrl) return;
        const win = window.open('', '_blank', 'width=460,height=680');
        if (!win) return;
        const barcodeImg = barcodeDataUrl
            ? `<img src="${barcodeDataUrl}" alt="Barcode" style="max-width: 100%; margin-top: 16px;" />`
            : '';
        win.document.write(`
            <html>
                <head><title>${employee.fullName} — Badge</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 32px;">
                    <h2 style="margin-bottom: 4px;">${employee.fullName}</h2>
                    <p style="color: #555; margin-top: 0;">${employee.employeeCode}</p>
                    <img src="${qrDataUrl}" alt="QR" style="width: 280px; height: 280px;" />
                    ${barcodeImg}
                </body>
            </html>
        `);
        win.document.close();
        win.focus();
        win.print();
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6">
                {showSuccessBanner && (
                    <div className="mb-4 flex items-center gap-2 text-live">
                        <Icon name="check" width={20} height={20} />
                        <span className="font-semibold">Employee registered successfully</span>
                    </div>
                )}

                <div className="flex flex-col items-center text-center">
                    <p className="font-display text-xl font-extrabold text-olive-deep">{employee.fullName}</p>
                    <p className="mt-1 flex items-center gap-1 font-mono text-sm text-muted">
                        <Icon name="badge" width={14} height={14} /> {employee.employeeCode}
                    </p>

                    <div className="my-6 flex h-70 w-70 items-center justify-center rounded-xl border-2 border-dashed border-edge bg-white">
                        {qrError ? (
                            <span className="px-4 text-sm text-rust">{qrError}</span>
                        ) : qrDataUrl ? (
                            <img src={qrDataUrl} alt={`QR badge for ${employee.fullName}`} className="h-full w-full" />
                        ) : (
                            <span className="text-sm text-muted">Generating QR…</span>
                        )}
                    </div>

                    {/* Code 128 barcode for handheld scanners. */}
                    <div className="mb-2 w-full max-w-sm">
                        <p className="kicker mb-1">Barcode (handheld scanner)</p>
                        <div className="flex w-full items-center justify-center overflow-x-auto rounded-xl border border-edge bg-white p-3">
                            <canvas ref={barcodeRef} className="max-w-full" />
                        </div>
                    </div>

                    <div className="flex w-full max-w-sm flex-wrap gap-3">
                        <a
                            href={qrDataUrl ?? '#'}
                            download={`${employee.employeeCode}-qr.png`}
                            aria-disabled={!qrDataUrl}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-rust py-3 font-semibold text-canvas transition-colors hover:bg-rust/90 ${
                                qrDataUrl ? '' : 'pointer-events-none opacity-50'
                            }`}
                        >
                            <Icon name="upload" width={18} height={18} className="rotate-180" /> QR
                        </a>
                        <a
                            href={barcodeDataUrl ?? '#'}
                            download={`${employee.employeeCode}-barcode.png`}
                            aria-disabled={!barcodeDataUrl}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-olive-deep py-3 font-semibold text-bone-light transition-colors hover:bg-olive-deep/90 ${
                                barcodeDataUrl ? '' : 'pointer-events-none opacity-50'
                            }`}
                        >
                            <Icon name="upload" width={18} height={18} className="rotate-180" /> Barcode
                        </a>
                        <button
                            onClick={handlePrint}
                            disabled={!qrDataUrl}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-edge bg-white py-3 font-semibold text-olive-deep transition-colors hover:bg-bone-light disabled:opacity-50"
                        >
                            <Icon name="form" width={18} height={18} /> Print
                        </button>
                    </div>

                    {footer}
                </div>
            </Card>
        </motion.div>
    );
}
