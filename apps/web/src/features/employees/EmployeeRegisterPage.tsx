import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Button } from '../../components/ui/primitives';

type Employee = RouterOutputs['employee']['register'];

interface FormState {
    fullName: string;
    email: string;
    phone: string;
    department: string;
    position: string;
}

const EMPTY_FORM: FormState = {
    fullName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
};

export default function EmployeeRegisterPage() {
    const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
    const [registered, setRegistered] = useState<Employee | null>(null);

    const registerMutation = trpc.employee.register.useMutation({
        onSuccess: (employee) => setRegistered(employee),
    });
    const { hasModule, isLoading } = useSubscription();

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-muted">
                <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
            </div>
        );
    }

    if (!hasModule('WORKFORCE')) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <UpgradePrompt module="WORKFORCE" />
            </div>
        );
    }

    const handleChange = (field: keyof FormState, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.fullName.trim()) return;
        registerMutation.mutate({
            fullName: form.fullName.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            department: form.department.trim() || undefined,
            position: form.position.trim() || undefined,
        });
    };

    const handleRegisterAnother = () => {
        setRegistered(null);
        setForm({ ...EMPTY_FORM });
        registerMutation.reset();
    };

    return (
        <div className="mx-auto max-w-2xl">
            <PageHeader
                title="Employee Registration"
                subtitle="Fill in the employee details once to generate their personal QR badge."
                icon={<Icon name="users" width={22} height={22} />}
                actions={
                    <Link to="/app/timesheet">
                        <Button variant="secondary">
                            <Icon name="clock" width={15} height={15} />
                            Timesheet
                        </Button>
                    </Link>
                }
            />

            {registered ? (
                <EmployeeBadge employee={registered} onRegisterAnother={handleRegisterAnother} />
            ) : (
                <Card as="section" className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Field
                            label="Full name"
                            required
                            value={form.fullName}
                            onChange={(v) => handleChange('fullName', v)}
                            placeholder="Jane Doe"
                        />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="Email"
                                type="email"
                                value={form.email}
                                onChange={(v) => handleChange('email', v)}
                                placeholder="jane@company.com"
                            />
                            <Field
                                label="Phone"
                                value={form.phone}
                                onChange={(v) => handleChange('phone', v)}
                                placeholder="+1 555 0100"
                            />
                            <Field
                                label="Department"
                                value={form.department}
                                onChange={(v) => handleChange('department', v)}
                                placeholder="Operations"
                            />
                            <Field
                                label="Position"
                                value={form.position}
                                onChange={(v) => handleChange('position', v)}
                                placeholder="Technician"
                            />
                        </div>

                        {registerMutation.isError && (
                            <div className="rounded-xl border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
                                {registerMutation.error.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={registerMutation.isPending || !form.fullName.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rust py-3.5 text-sm font-semibold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
                        >
                            <Icon name="badge" width={16} height={16} />
                            {registerMutation.isPending ? 'Registering…' : 'Register & Generate QR'}
                        </button>
                    </form>
                </Card>
            )}
        </div>
    );
}

interface FieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: FieldProps) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-olive-deep">
                {label}
                {required && <span className="text-rust"> *</span>}
            </span>
            <input
                type={type}
                value={value}
                required={required}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-edge bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
            />
        </label>
    );
}

interface EmployeeBadgeProps {
    employee: Employee;
    onRegisterAnother: () => void;
}

function EmployeeBadge({ employee, onRegisterAnother }: EmployeeBadgeProps) {
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

    // Render the same token as a Code 128 1D barcode for handheld scanners (e.g. Inateck BCST-70).
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
                <div className="mb-4 flex items-center gap-2 text-live">
                    <Icon name="check" width={20} height={20} />
                    <span className="font-semibold">Employee registered successfully</span>
                </div>

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

                    {/* Code 128 barcode for handheld scanners (e.g. Inateck BCST-70). */}
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

                    <button onClick={onRegisterAnother} className="mt-4 text-sm font-medium text-rust hover:underline">
                        Register another employee
                    </button>
                </div>
            </Card>
        </motion.div>
    );
}
