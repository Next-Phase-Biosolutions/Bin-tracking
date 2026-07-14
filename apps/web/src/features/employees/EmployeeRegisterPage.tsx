import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Link } from 'react-router-dom';
import { UserPlus, Download, Printer, CheckCircle2, IdCard } from 'lucide-react';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';

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
    const { hasModule } = useSubscription();

    if (!hasModule('WORKFORCE')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-2xl">
                <header className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Employee Registration</h1>
                        <p className="mt-1 text-sm text-gray-600">
                            Fill in the employee details once to generate their personal QR badge.
                        </p>
                    </div>
                    <Link
                        to="/app/timesheet"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                    >
                        Timesheet
                    </Link>
                </header>

                {registered ? (
                    <EmployeeBadge employee={registered} onRegisterAnother={handleRegisterAnother} />
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                    >
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
                            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                                {registerMutation.error.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={registerMutation.isPending || !form.fullName.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3d5aa8] py-3.5 text-lg font-bold text-white transition-colors hover:bg-[#2d4280] disabled:opacity-50"
                        >
                            <UserPlus className="h-5 w-5" />
                            {registerMutation.isPending ? 'Registering...' : 'Register & Generate QR'}
                        </button>
                    </form>
                )}
            </div>
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
            <span className="mb-1 block text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </span>
            <input
                type={type}
                value={value}
                required={required}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#3d5aa8] focus:ring-[#3d5aa8]"
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
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                <span className="font-semibold">Employee registered successfully</span>
            </div>

            <div className="flex flex-col items-center text-center">
                <p className="text-xl font-bold text-gray-900">{employee.fullName}</p>
                <p className="mt-1 flex items-center gap-1 font-mono text-sm text-gray-500">
                    <IdCard className="h-4 w-4" /> {employee.employeeCode}
                </p>

                <div className="my-6 flex h-[280px] w-[280px] items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
                    {qrError ? (
                        <span className="px-4 text-sm text-red-600">{qrError}</span>
                    ) : qrDataUrl ? (
                        <img src={qrDataUrl} alt={`QR badge for ${employee.fullName}`} className="h-full w-full" />
                    ) : (
                        <span className="text-sm text-gray-400">Generating QR…</span>
                    )}
                </div>

                {/* Code 128 barcode for handheld scanners (e.g. Inateck BCST-70) */}
                <div className="mb-2 w-full max-w-sm">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">
                        Barcode (handheld scanner)
                    </p>
                    <div className="flex w-full items-center justify-center overflow-x-auto rounded-xl border border-gray-200 bg-white p-3">
                        <canvas ref={barcodeRef} className="max-w-full" />
                    </div>
                </div>

                <div className="flex w-full max-w-sm flex-wrap gap-3">
                    <a
                        href={qrDataUrl ?? '#'}
                        download={`${employee.employeeCode}-qr.png`}
                        aria-disabled={!qrDataUrl}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#3d5aa8] py-3 font-semibold text-white transition-colors hover:bg-[#2d4280] ${
                            qrDataUrl ? '' : 'pointer-events-none opacity-50'
                        }`}
                    >
                        <Download className="h-5 w-5" /> QR
                    </a>
                    <a
                        href={barcodeDataUrl ?? '#'}
                        download={`${employee.employeeCode}-barcode.png`}
                        aria-disabled={!barcodeDataUrl}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#043F2E] py-3 font-semibold text-white transition-colors hover:bg-[#032f22] ${
                            barcodeDataUrl ? '' : 'pointer-events-none opacity-50'
                        }`}
                    >
                        <Download className="h-5 w-5" /> Barcode
                    </a>
                    <button
                        onClick={handlePrint}
                        disabled={!qrDataUrl}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                        <Printer className="h-5 w-5" /> Print
                    </button>
                </div>

                <button
                    onClick={onRegisterAnother}
                    className="mt-4 text-sm font-medium text-[#3d5aa8] hover:underline"
                >
                    Register another employee
                </button>
            </div>
        </div>
    );
}
