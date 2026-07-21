import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { PageHeader } from '../../components/app/PageHeader';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { Icon } from '../../components/ui/Icon';
import { Card, Button } from '../../components/ui/primitives';
import { EmployeeBadge } from './EmployeeBadge';
import { Field } from './Field';

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
            <div className="flex min-h-[60vh] items-center justify-center">
                <FacilityLoader variant="inline" label="employees" />
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
                    <Link to="/app/employees">
                        <Button variant="secondary">
                            <Icon name="users" width={15} height={15} />
                            All Employees
                        </Button>
                    </Link>
                }
            />

            {registered ? (
                <EmployeeBadge
                    employee={registered}
                    showSuccessBanner
                    footer={
                        <button
                            onClick={handleRegisterAnother}
                            className="mt-4 text-sm font-medium text-rust hover:underline"
                        >
                            Register another employee
                        </button>
                    }
                />
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
