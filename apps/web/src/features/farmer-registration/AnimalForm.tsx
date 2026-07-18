import { Link } from 'react-router-dom';
import type { ExtractedAnimalFields } from '@bin-tracker/validators';
import { Card } from '../../components/ui/primitives';

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
        <Card className="p-6">
            <h2 className="font-display text-lg font-bold text-olive-deep">Animal Details</h2>

            <div className="mt-5 flex flex-col gap-4">
                {FIELD_CONFIG.map(({ key, label, placeholder }) => (
                    <div key={key}>
                        <label className="mb-1.5 block text-xs font-semibold text-olive-deep">
                            {label}
                            {(key === 'animalType' || key === 'ownerName') && <span className="text-rust"> *</span>}
                        </label>
                        <input
                            type="text"
                            value={fields[key] ?? ''}
                            onChange={(e) => onChange(key, e.target.value)}
                            placeholder={placeholder}
                            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rust focus:outline-none ${fields[key] ? 'border-live/40' : 'border-edge'}`}
                        />
                    </div>
                ))}
            </div>

            <button
                onClick={onSubmit}
                disabled={isSubmitting || !fields.animalType || !fields.ownerName}
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
