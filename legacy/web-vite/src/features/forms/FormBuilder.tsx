import { useState } from 'react';
import {
    ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
    CheckCircle2, Settings2, GripVertical, Star, Eye,
} from 'lucide-react';
import { FieldTypePicker, FIELD_TYPE_CONFIG, type BuilderFieldType } from './FieldTypePicker';

// ─── Internal state types ─────────────────────────────────────────────────────

export interface BuilderField {
    id: string;
    type: BuilderFieldType;
    label: string;
    required: boolean;
    placeholder: string;
    options: string[];
    unit: 'C' | 'F';
}

export interface BuilderSection {
    id: string;
    title: string;
    fields: BuilderField[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
    return crypto.randomUUID();
}

function defaultField(type: BuilderFieldType): BuilderField {
    return {
        id: uid(),
        type,
        label: '',
        required: false,
        placeholder: '',
        options: type === 'dropdown' || type === 'radio' ? ['Option 1', 'Option 2'] : [],
        unit: 'C',
    };
}

function defaultSection(): BuilderSection {
    return { id: uid(), title: '', fields: [] };
}

const NEEDS_OPTIONS: BuilderFieldType[] = ['dropdown', 'radio'];
const NEEDS_UNIT: BuilderFieldType[] = ['temperature'];
const HAS_PLACEHOLDER: BuilderFieldType[] = ['short_text', 'long_text', 'number', 'email', 'phone', 'slider'];

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#043F2E] focus:border-transparent bg-white';
const labelCls = 'block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide';
const previewInputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-400 bg-gray-50 focus:outline-none';

// ─── Live field preview ───────────────────────────────────────────────────────

function FieldPreview({ field }: { field: BuilderField }) {
    const displayLabel = field.label || `${FIELD_TYPE_CONFIG[field.type].label} field`;
    const [ratingHover, setRatingHover] = useState(0);
    const [ratingVal, setRatingVal] = useState(0);

    const previewLabel = (
        <p className="text-sm font-semibold text-gray-700 mb-2">
            {displayLabel}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </p>
    );

    switch (field.type) {
        case 'short_text':
        case 'email':
        case 'phone':
            return (
                <div>
                    {previewLabel}
                    <input
                        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        className={previewInputCls}
                        placeholder={field.placeholder || (field.type === 'email' ? 'name@example.com' : field.type === 'phone' ? '+1 (555) 000-0000' : 'Type here...')}
                        readOnly
                    />
                </div>
            );

        case 'long_text':
            return (
                <div>
                    {previewLabel}
                    <textarea
                        rows={3}
                        className={`${previewInputCls} resize-none`}
                        placeholder={field.placeholder || 'Type here...'}
                        readOnly
                    />
                </div>
            );

        case 'number':
            return (
                <div>
                    {previewLabel}
                    <input
                        type="number"
                        className={previewInputCls}
                        placeholder={field.placeholder || '0'}
                        readOnly
                    />
                </div>
            );

        case 'date':
            return (
                <div>
                    {previewLabel}
                    <input type="date" className={`${previewInputCls} text-gray-600`} />
                </div>
            );

        case 'time':
            return (
                <div>
                    {previewLabel}
                    <input type="time" className={`${previewInputCls} text-gray-600`} />
                </div>
            );

        case 'dropdown':
            return (
                <div>
                    {previewLabel}
                    <select className={`${previewInputCls} text-gray-500`}>
                        <option value="">— Select an option —</option>
                        {field.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>
            );

        case 'radio':
            return (
                <div>
                    {previewLabel}
                    <div className="flex flex-col gap-2">
                        {field.options.map((opt) => (
                            <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                                <input type="radio" name={`preview-${field.id}`} className="accent-[#043F2E] w-4 h-4" readOnly />
                                <span className="text-sm text-gray-700">{opt}</span>
                            </label>
                        ))}
                    </div>
                </div>
            );

        case 'checkbox':
            return (
                <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="accent-[#043F2E] w-4 h-4 mt-0.5" readOnly />
                    <span className="text-sm font-semibold text-gray-700">{displayLabel}</span>
                </label>
            );

        case 'yes_no':
            return (
                <div>
                    {previewLabel}
                    <div className="flex gap-3">
                        <button type="button" className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-green-500 text-green-600 bg-green-50 hover:bg-green-100 transition-colors">
                            Yes
                        </button>
                        <button type="button" className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-red-400 text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                            No
                        </button>
                    </div>
                </div>
            );

        case 'temperature':
            return (
                <div>
                    {previewLabel}
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            step="0.1"
                            className={`${previewInputCls} flex-1`}
                            placeholder="0.0"
                            readOnly
                        />
                        <div className="flex gap-1">
                            {(['C', 'F'] as const).map((u) => (
                                <span
                                    key={u}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold border ${
                                        field.unit === u
                                            ? 'bg-[#043F2E] text-white border-[#043F2E]'
                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                    }`}
                                >
                                    °{u}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            );

        case 'rating':
            return (
                <div>
                    {previewLabel}
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onMouseEnter={() => setRatingHover(n)}
                                onMouseLeave={() => setRatingHover(0)}
                                onClick={() => setRatingVal(n)}
                                className="transition-transform hover:scale-110"
                            >
                                <Star
                                    className={`w-8 h-8 transition-colors ${
                                        n <= (ratingHover || ratingVal)
                                            ? 'text-yellow-400 fill-yellow-400'
                                            : 'text-gray-300'
                                    }`}
                                />
                            </button>
                        ))}
                    </div>
                    {ratingVal > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{ratingVal} / 5</p>
                    )}
                </div>
            );

        case 'slider': {
            const [sliderVal, setSliderVal] = useState(5);
            return (
                <div>
                    {previewLabel}
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-4">0</span>
                        <input
                            type="range"
                            min={0}
                            max={10}
                            value={sliderVal}
                            onChange={(e) => setSliderVal(Number(e.target.value))}
                            className="flex-1 accent-[#043F2E]"
                        />
                        <span className="text-xs text-gray-400 w-4">10</span>
                    </div>
                    <p className="text-center text-sm font-bold text-[#043F2E] mt-1">{sliderVal}</p>
                </div>
            );
        }

        case 'label_heading':
            return (
                <div className="py-1">
                    <h3 className="text-base font-bold text-gray-800">
                        {displayLabel}
                    </h3>
                    <div className="h-0.5 bg-gray-200 rounded mt-2" />
                </div>
            );

        default:
            return null;
    }
}

// ─── Field config editor (shown when a field card is expanded) ────────────────

interface FieldEditorProps {
    field: BuilderField;
    sectionId: string;
    onChange: (sectionId: string, fieldId: string, patch: Partial<BuilderField>) => void;
    onAddOption: (sectionId: string, fieldId: string) => void;
    onUpdateOption: (sectionId: string, fieldId: string, idx: number, value: string) => void;
    onRemoveOption: (sectionId: string, fieldId: string, idx: number) => void;
}

function FieldEditor({ field, sectionId, onChange, onAddOption, onUpdateOption, onRemoveOption }: FieldEditorProps) {
    const isLabelOnly = field.type === 'label_heading';

    return (
        <div className="border-t border-gray-100 pt-3 mt-3 flex flex-col gap-4">

            {/* ── CONFIGURE section ─────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
                <p className={labelCls}>Configure</p>

                {/* Label */}
                <div>
                    <label className={labelCls}>{isLabelOnly ? 'Heading Text' : 'Field Label'}</label>
                    <input
                        type="text"
                        className={inputCls}
                        placeholder={isLabelOnly ? 'e.g. General Information' : 'e.g. Inspector Name'}
                        value={field.label}
                        onChange={(e) => onChange(sectionId, field.id, { label: e.target.value })}
                    />
                </div>

                {/* Placeholder — only for text-like fields */}
                {HAS_PLACEHOLDER.includes(field.type) && (
                    <div>
                        <label className={labelCls}>Placeholder (optional)</label>
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="Hint text shown inside the field"
                            value={field.placeholder}
                            onChange={(e) => onChange(sectionId, field.id, { placeholder: e.target.value })}
                        />
                    </div>
                )}

                {/* Temperature unit */}
                {NEEDS_UNIT.includes(field.type) && (
                    <div>
                        <label className={labelCls}>Unit</label>
                        <div className="flex gap-2">
                            {(['C', 'F'] as const).map((u) => (
                                <button
                                    key={u}
                                    type="button"
                                    onClick={() => onChange(sectionId, field.id, { unit: u })}
                                    className={`px-5 py-2 rounded-lg text-sm font-bold border transition-colors ${
                                        field.unit === u
                                            ? 'bg-[#043F2E] text-white border-[#043F2E]'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                    }`}
                                >
                                    °{u}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Options list for dropdown / radio */}
                {NEEDS_OPTIONS.includes(field.type) && (
                    <div>
                        <label className={labelCls}>Options</label>
                        <div className="flex flex-col gap-2">
                            {field.options.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                                        {field.type === 'radio'
                                            ? <div className="w-3 h-3 rounded-full border-2 border-gray-400" />
                                            : <div className="w-3 h-3 rounded border-2 border-gray-400" />
                                        }
                                    </div>
                                    <input
                                        type="text"
                                        className={inputCls}
                                        value={opt}
                                        onChange={(e) => onUpdateOption(sectionId, field.id, idx, e.target.value)}
                                        placeholder={`Option ${idx + 1}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onRemoveOption(sectionId, field.id, idx)}
                                        disabled={field.options.length <= 1}
                                        className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors shrink-0"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => onAddOption(sectionId, field.id)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-[#043F2E] hover:text-[#032f22] transition-colors mt-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add option
                            </button>
                        </div>
                    </div>
                )}

                {/* Required toggle */}
                {!isLabelOnly && (
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-medium text-gray-700">Required field</span>
                        <button
                            type="button"
                            onClick={() => onChange(sectionId, field.id, { required: !field.required })}
                            className={`relative w-11 h-6 rounded-full transition-colors ${field.required ? 'bg-[#043F2E]' : 'bg-gray-300'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${field.required ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                )}
            </div>

            {/* ── PREVIEW section ───────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-1.5 mb-3">
                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preview</p>
                </div>
                <FieldPreview field={field} />
            </div>
        </div>
    );
}

// ─── Field card (collapsed + expanded) ───────────────────────────────────────

interface FieldCardProps {
    field: BuilderField;
    sectionId: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onDelete: () => void;
    onChange: (sectionId: string, fieldId: string, patch: Partial<BuilderField>) => void;
    onAddOption: (sectionId: string, fieldId: string) => void;
    onUpdateOption: (sectionId: string, fieldId: string, idx: number, value: string) => void;
    onRemoveOption: (sectionId: string, fieldId: string, idx: number) => void;
}

function FieldCard({
    field, sectionId, isExpanded, onToggleExpand, onDelete,
    onChange, onAddOption, onUpdateOption, onRemoveOption,
}: FieldCardProps) {
    const cfg = FIELD_TYPE_CONFIG[field.type];
    const { Icon } = cfg;

    return (
        <div className={`rounded-xl border-2 transition-colors ${isExpanded ? `${cfg.borderColor} ${cfg.bgColor}` : 'border-gray-100 bg-gray-50'}`}>
            {/* Header row */}
            <div className="flex items-center gap-2 px-3 py-2.5">
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                <div className={`p-1.5 rounded-lg shrink-0 ${isExpanded ? cfg.bgColor : 'bg-white'} border ${cfg.borderColor}`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <span className={`text-xs font-bold ${cfg.iconColor}`}>{cfg.label}</span>
                    {field.label && (
                        <p className="text-xs text-gray-500 truncate leading-tight">{field.label}</p>
                    )}
                </div>
                {field.required && (
                    <span className="text-[10px] font-bold text-red-500 shrink-0">REQ</span>
                )}
                <button
                    type="button"
                    onClick={onToggleExpand}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                >
                    <Settings2 className="w-3.5 h-3.5" />
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Expanded editor */}
            {isExpanded && (
                <div className="px-3 pb-3">
                    <FieldEditor
                        field={field}
                        sectionId={sectionId}
                        onChange={onChange}
                        onAddOption={onAddOption}
                        onUpdateOption={onUpdateOption}
                        onRemoveOption={onRemoveOption}
                    />
                </div>
            )}
        </div>
    );
}

// ─── Main FormBuilder ─────────────────────────────────────────────────────────

interface Props {
    onBack: () => void;
}

export function FormBuilder({ onBack }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [sections, setSections] = useState<BuilderSection[]>([defaultSection()]);
    const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
    const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [titleError, setTitleError] = useState(false);

    const toggleExpanded = (fieldId: string) => {
        setExpandedFields((prev) => {
            const next = new Set(prev);
            if (next.has(fieldId)) next.delete(fieldId);
            else next.add(fieldId);
            return next;
        });
    };

    const addSection = () => setSections((prev) => [...prev, defaultSection()]);

    const removeSection = (id: string) => setSections((prev) => prev.filter((s) => s.id !== id));

    const updateSectionTitle = (id: string, value: string) =>
        setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title: value } : s)));

    const addField = (sectionId: string, type: BuilderFieldType) => {
        const field = defaultField(type);
        setSections((prev) =>
            prev.map((s) => (s.id === sectionId ? { ...s, fields: [...s.fields, field] } : s)),
        );
        setExpandedFields((prev) => new Set([...prev, field.id]));
    };

    const removeField = (sectionId: string, fieldId: string) => {
        setSections((prev) =>
            prev.map((s) =>
                s.id === sectionId ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) } : s,
            ),
        );
        setExpandedFields((prev) => { const n = new Set(prev); n.delete(fieldId); return n; });
    };

    const updateField = (sectionId: string, fieldId: string, patch: Partial<BuilderField>) => {
        setSections((prev) =>
            prev.map((s) =>
                s.id === sectionId
                    ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }
                    : s,
            ),
        );
    };

    const addOption = (sectionId: string, fieldId: string) => {
        setSections((prev) =>
            prev.map((s) =>
                s.id === sectionId
                    ? {
                          ...s,
                          fields: s.fields.map((f) =>
                              f.id === fieldId
                                  ? { ...f, options: [...f.options, `Option ${f.options.length + 1}`] }
                                  : f,
                          ),
                      }
                    : s,
            ),
        );
    };

    const updateOption = (sectionId: string, fieldId: string, idx: number, value: string) => {
        setSections((prev) =>
            prev.map((s) =>
                s.id === sectionId
                    ? {
                          ...s,
                          fields: s.fields.map((f) => {
                              if (f.id !== fieldId) return f;
                              const opts = [...f.options];
                              opts[idx] = value;
                              return { ...f, options: opts };
                          }),
                      }
                    : s,
            ),
        );
    };

    const removeOption = (sectionId: string, fieldId: string, idx: number) => {
        setSections((prev) =>
            prev.map((s) =>
                s.id === sectionId
                    ? {
                          ...s,
                          fields: s.fields.map((f) =>
                              f.id === fieldId
                                  ? { ...f, options: f.options.filter((_, i) => i !== idx) }
                                  : f,
                          ),
                      }
                    : s,
            ),
        );
    };

    const totalFields = sections.reduce((sum, s) => sum + s.fields.length, 0);

    const handleSave = () => {
        if (!title.trim()) {
            setTitleError(true);
            return;
        }
        // TODO: wire up to trpc.form.create when the API endpoint is added
        setSaved(true);
    };

    // ── Success screen ────────────────────────────────────────────────────────
    if (saved) {
        return (
            <div className="min-h-screen bg-[#F5F8F2] flex flex-col items-center justify-center px-4 text-center">
                <div className="bg-green-50 rounded-full p-6 mb-6">
                    <CheckCircle2 className="w-20 h-20 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-[#043F2E] mb-2">Form Created!</h2>
                <p className="text-gray-600 text-lg font-medium mb-1">{title}</p>
                <p className="text-gray-400 text-sm mb-2">{totalFields} field{totalFields !== 1 ? 's' : ''} across {sections.length} section{sections.length !== 1 ? 's' : ''}</p>
                <button
                    type="button"
                    onClick={onBack}
                    className="mt-6 bg-[#043F2E] hover:bg-[#032f22] text-white px-8 py-3 rounded-xl font-bold text-base transition-colors"
                >
                    Back to Forms
                </button>
            </div>
        );
    }

    // ── Builder UI ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#F5F8F2]">
            {/* Header */}
            <div className="bg-[#043F2E] px-4 pt-10 pb-6">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Forms
                </button>
                <h1 className="text-2xl font-bold text-white leading-tight">Create New Form</h1>
                <p className="text-white/60 text-sm mt-1">Build a custom form with any field types you need</p>
            </div>

            <div className="px-4 py-6 max-w-2xl mx-auto pb-32">
                {/* ── Form details ─────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
                    <h2 className="text-sm font-bold text-[#043F2E] uppercase tracking-wide mb-4">Form Details</h2>

                    <div className="flex flex-col gap-4">
                        <div>
                            <label className={labelCls}>
                                Form Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className={`${inputCls} ${titleError ? 'border-red-400 focus:ring-red-400' : ''}`}
                                placeholder="e.g. Daily Temperature Log"
                                value={title}
                                onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
                            />
                            {titleError && <p className="text-red-500 text-xs mt-1">Form name is required</p>}
                        </div>

                        <div>
                            <label className={labelCls}>Description (optional)</label>
                            <textarea
                                rows={2}
                                className={`${inputCls} resize-none`}
                                placeholder="Brief description of what this form is for"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Sections ─────────────────────────────────────────────── */}
                <div className="flex flex-col gap-4">
                    {sections.map((section, sectionIdx) => (
                        <div
                            key={section.id}
                            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                        >
                            {/* Section header */}
                            <div className="bg-[#043F2E]/5 border-b border-gray-100 px-5 py-3 flex items-center gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        className="w-full bg-transparent text-sm font-bold text-[#043F2E] placeholder-[#043F2E]/40 focus:outline-none"
                                        placeholder={`Section ${sectionIdx + 1} title (optional)`}
                                        value={section.title}
                                        onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                                    />
                                    <p className="text-xs text-gray-400 mt-0.5">{section.fields.length} field{section.fields.length !== 1 ? 's' : ''}</p>
                                </div>
                                {sections.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeSection(section.id)}
                                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Fields */}
                            <div className="px-4 py-3 flex flex-col gap-2">
                                {section.fields.length === 0 && (
                                    <p className="text-center text-xs text-gray-400 py-4">
                                        No fields yet — click "Add Field" to start
                                    </p>
                                )}
                                {section.fields.map((field) => (
                                    <FieldCard
                                        key={field.id}
                                        field={field}
                                        sectionId={section.id}
                                        isExpanded={expandedFields.has(field.id)}
                                        onToggleExpand={() => toggleExpanded(field.id)}
                                        onDelete={() => removeField(section.id, field.id)}
                                        onChange={updateField}
                                        onAddOption={addOption}
                                        onUpdateOption={updateOption}
                                        onRemoveOption={removeOption}
                                    />
                                ))}
                            </div>

                            {/* Add field button */}
                            <div className="px-4 pb-4">
                                <button
                                    type="button"
                                    onClick={() => setPickerSectionId(section.id)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#043F2E]/30 text-[#043F2E] text-sm font-semibold hover:border-[#043F2E]/60 hover:bg-[#043F2E]/5 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Field
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add section button */}
                <button
                    type="button"
                    onClick={addSection}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-semibold hover:border-gray-400 hover:text-gray-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Section
                </button>
            </div>

            {/* Fixed save button */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <div className="flex-1 text-xs text-gray-400">
                        {totalFields > 0
                            ? `${totalFields} field${totalFields !== 1 ? 's' : ''} · ${sections.length} section${sections.length !== 1 ? 's' : ''}`
                            : 'Add fields to your form'}
                    </div>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="bg-[#043F2E] hover:bg-[#032f22] text-white px-8 py-3 rounded-xl text-sm font-bold transition-colors"
                    >
                        Save Form
                    </button>
                </div>
            </div>

            {/* Field type picker bottom sheet */}
            {pickerSectionId && (
                <FieldTypePicker
                    onSelect={(type) => addField(pickerSectionId, type)}
                    onClose={() => setPickerSectionId(null)}
                />
            )}
        </div>
    );
}
