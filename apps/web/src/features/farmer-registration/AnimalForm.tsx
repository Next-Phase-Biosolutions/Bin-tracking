import type { ExtractedAnimalFields } from '@bin-tracker/validators';

interface AnimalFormProps {
    fields: Partial<ExtractedAnimalFields>;
    onChange: (field: keyof ExtractedAnimalFields, value: string) => void;
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
    { key: 'ownerName', label: 'Owner Name', placeholder: 'e.g. Abdul Rehman' },
    { key: 'healthCondition', label: 'Health Condition', placeholder: 'e.g. Healthy, no issues' },
];

export function AnimalForm({ fields, onChange, onSubmit, isSubmitting, submitSuccess }: AnimalFormProps) {
    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-lg font-semibold text-gray-900">Animal Details</h2>

                <div className="flex flex-col gap-4">
                    {FIELD_CONFIG.map(({ key, label, placeholder }) => (
                        <div key={key}>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                {label}
                                {(key === 'animalType' || key === 'ownerName') && (
                                    <span className="ml-1 text-red-500">*</span>
                                )}
                            </label>
                            <input
                                type="text"
                                value={fields[key] ?? ''}
                                onChange={(e) => onChange(key, e.target.value)}
                                placeholder={placeholder}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    ))}
                </div>

                <button
                    onClick={onSubmit}
                    disabled={isSubmitting || !fields.animalType || !fields.ownerName}
                    className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {isSubmitting ? 'Saving...' : 'Submit Registration'}
                </button>

                {submitSuccess && (
                    <p className="mt-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                        Animal registration saved successfully.
                    </p>
                )}
            </div>
        </div>
    );
}
