import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExtractedAnimalFields } from '@bin-tracker/validators';
import { Card } from '../../components/ui/primitives';

interface EmployeeOption {
    id: string;
    fullName: string;
    employeeCode: string;
}

interface AnimalFormProps {
    fields: Partial<ExtractedAnimalFields>;
    onChange: (field: keyof ExtractedAnimalFields, value: string) => void;
    employees: EmployeeOption[];
    employeeId: string | null;
    onEmployeeChange: (id: string | null) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    submitSuccess: boolean;
}

const FIELD_CONFIG: Array<{
    key: keyof ExtractedAnimalFields;
    label: string;
    placeholder: string;
}> = [
    { key: 'animalType', label: 'Animal Type', placeholder: 'e.g. Cow, Goat, Sheep' },
    { key: 'breed', label: 'Breed', placeholder: 'e.g. Holstein, Boer' },
    { key: 'age', label: 'Age', placeholder: 'e.g. 3 years' },
    { key: 'weight', label: 'Weight', placeholder: 'e.g. 250 kg' },
    { key: 'plantId', label: 'Plant ID', placeholder: 'e.g. 0007' },
    { key: 'healthCondition', label: 'Health Condition', placeholder: 'e.g. Healthy, no issues' },
];

function employeeLabel(e: EmployeeOption): string {
    return `${e.fullName} (${e.employeeCode})`;
}

export function AnimalForm({
    fields,
    onChange,
    employees,
    employeeId,
    onEmployeeChange,
    onSubmit,
    isSubmitting,
    submitSuccess,
}: AnimalFormProps) {
    const isPlantIdValid = /^\d{4}$/.test(fields.plantId ?? '');

    return (
        <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-olive-deep">Animal Details</h2>

            <div className="mt-5 flex flex-col gap-4">
                {FIELD_CONFIG.map(({ key, label, placeholder }) => (
                    <div key={key}>
                        <label className="mb-1.5 block text-xs font-semibold text-olive-deep">
                            {label}
                            {(key === 'animalType' || key === 'plantId') && (
                                <span className="text-rust"> *</span>
                            )}
                        </label>
                        <input
                            type="text"
                            value={fields[key] ?? ''}
                            onChange={(e) => onChange(key, e.target.value)}
                            placeholder={placeholder}
                            maxLength={key === 'plantId' ? 4 : undefined}
                            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rust focus:outline-none ${
                                key === 'plantId'
                                    ? fields.plantId
                                        ? isPlantIdValid
                                            ? 'border-live/40'
                                            : 'border-rust/60'
                                        : 'border-edge'
                                    : fields[key]
                                      ? 'border-live/40'
                                      : 'border-edge'
                            }`}
                        />
                        {key === 'plantId' && fields.plantId && !isPlantIdValid && (
                            <p className="mt-1 text-xs text-rust">Must be exactly 4 digits</p>
                        )}
                    </div>
                ))}

                <EmployeeCombobox
                    employees={employees}
                    employeeId={employeeId}
                    onEmployeeChange={onEmployeeChange}
                    initialSearch={fields.employeeReceived ?? null}
                />
            </div>

            <button
                onClick={onSubmit}
                disabled={isSubmitting || !fields.animalType || !isPlantIdValid || !employeeId}
                className="mt-6 w-full rounded-xl bg-olive-deep px-4 py-3 text-sm font-semibold text-bone-light transition-colors hover:bg-olive-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isSubmitting ? 'Saving…' : 'Submit Registration'}
            </button>

            {submitSuccess && (
                <p className="mt-3 rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-sm text-live">
                    Animal registration saved successfully.{' '}
                    <Link to="/app/animals" className="font-semibold underline hover:no-underline">
                        View all records
                    </Link>
                </p>
            )}
        </Card>
    );
}

/**
 * Type-to-filter employee picker built on the native <datalist> element
 * (ladder: no combobox library needed). The typed text must exactly match
 * one option's label to resolve employeeId — anything else clears it, so
 * the field can only ever save a real employee, never free text.
 */
function EmployeeCombobox({
    employees,
    employeeId,
    onEmployeeChange,
    initialSearch,
}: {
    employees: EmployeeOption[];
    employeeId: string | null;
    onEmployeeChange: (id: string | null) => void;
    initialSearch: string | null;
}) {
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!employeeId) return;
        const match = employees.find((e) => e.id === employeeId);
        if (match) setSearch(employeeLabel(match));
    }, [employeeId, employees]);

    useEffect(() => {
        if (!employeeId && initialSearch) setSearch(initialSearch);
        // Only react to a fresh voice-extraction result, not every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSearch]);

    const handleInput = (value: string) => {
        setSearch(value);
        const match = employees.find((e) => employeeLabel(e) === value);
        onEmployeeChange(match ? match.id : null);
    };

    return (
        <div>
            <label className="mb-1.5 block text-xs font-semibold text-olive-deep">
                Employee Received
                <span className="text-rust"> *</span>
            </label>
            <input
                type="text"
                list="animal-form-employee-options"
                value={search}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="Type to search employees"
                className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rust focus:outline-none ${
                    employeeId ? 'border-live/40' : 'border-edge'
                }`}
            />
            <datalist id="animal-form-employee-options">
                {employees.map((e) => (
                    <option key={e.id} value={employeeLabel(e)} />
                ))}
            </datalist>
        </div>
    );
}
