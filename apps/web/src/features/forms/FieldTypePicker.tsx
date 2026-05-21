import { X, Type, AlignLeft, Hash, Calendar, Clock, ChevronDown, CheckSquare, ToggleLeft, Thermometer, Heading, Circle, Mail, Phone, Star, SlidersHorizontal } from 'lucide-react';

export type BuilderFieldType =
    | 'short_text'
    | 'long_text'
    | 'number'
    | 'date'
    | 'time'
    | 'dropdown'
    | 'radio'
    | 'checkbox'
    | 'yes_no'
    | 'temperature'
    | 'email'
    | 'phone'
    | 'rating'
    | 'slider'
    | 'label_heading';

interface FieldTypeOption {
    type: BuilderFieldType;
    label: string;
    description: string;
    Icon: React.ElementType;
    iconColor: string;
    bgColor: string;
    borderColor: string;
}

export const FIELD_TYPE_CONFIG: Record<BuilderFieldType, FieldTypeOption> = {
    short_text:    { type: 'short_text',    label: 'Short Text',     description: 'Single line',        Icon: Type,               iconColor: 'text-blue-600',    bgColor: 'bg-blue-50',    borderColor: 'border-blue-200' },
    long_text:     { type: 'long_text',     label: 'Long Text',      description: 'Multi-line',         Icon: AlignLeft,          iconColor: 'text-indigo-600',  bgColor: 'bg-indigo-50',  borderColor: 'border-indigo-200' },
    number:        { type: 'number',        label: 'Number',         description: 'Numeric value',      Icon: Hash,               iconColor: 'text-green-600',   bgColor: 'bg-green-50',   borderColor: 'border-green-200' },
    date:          { type: 'date',          label: 'Date',           description: 'Date picker',        Icon: Calendar,           iconColor: 'text-orange-600',  bgColor: 'bg-orange-50',  borderColor: 'border-orange-200' },
    time:          { type: 'time',          label: 'Time',           description: 'Time picker',        Icon: Clock,              iconColor: 'text-purple-600',  bgColor: 'bg-purple-50',  borderColor: 'border-purple-200' },
    dropdown:      { type: 'dropdown',      label: 'Dropdown',       description: 'Select from list',   Icon: ChevronDown,        iconColor: 'text-teal-600',    bgColor: 'bg-teal-50',    borderColor: 'border-teal-200' },
    radio:         { type: 'radio',         label: 'Radio Buttons',  description: 'Pick one option',    Icon: Circle,             iconColor: 'text-pink-600',    bgColor: 'bg-pink-50',    borderColor: 'border-pink-200' },
    checkbox:      { type: 'checkbox',      label: 'Checkbox',       description: 'Tick box',           Icon: CheckSquare,        iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    yes_no:        { type: 'yes_no',        label: 'Yes / No',       description: 'Toggle button',      Icon: ToggleLeft,         iconColor: 'text-red-600',     bgColor: 'bg-red-50',     borderColor: 'border-red-200' },
    temperature:   { type: 'temperature',   label: 'Temperature',    description: '°C or °F reading',   Icon: Thermometer,        iconColor: 'text-rose-600',    bgColor: 'bg-rose-50',    borderColor: 'border-rose-200' },
    email:         { type: 'email',         label: 'Email',          description: 'Email address',      Icon: Mail,               iconColor: 'text-sky-600',     bgColor: 'bg-sky-50',     borderColor: 'border-sky-200' },
    phone:         { type: 'phone',         label: 'Phone',          description: 'Phone number',       Icon: Phone,              iconColor: 'text-cyan-600',    bgColor: 'bg-cyan-50',    borderColor: 'border-cyan-200' },
    rating:        { type: 'rating',        label: 'Rating',         description: '1–5 stars',          Icon: Star,               iconColor: 'text-yellow-600',  bgColor: 'bg-yellow-50',  borderColor: 'border-yellow-200' },
    slider:        { type: 'slider',        label: 'Slider',         description: 'Range / scale',      Icon: SlidersHorizontal,  iconColor: 'text-violet-600',  bgColor: 'bg-violet-50',  borderColor: 'border-violet-200' },
    label_heading: { type: 'label_heading', label: 'Section Label',  description: 'Display text',       Icon: Heading,            iconColor: 'text-gray-600',    bgColor: 'bg-gray-100',   borderColor: 'border-gray-200' },
};

const FIELD_TYPE_ORDER: BuilderFieldType[] = [
    'short_text', 'long_text', 'number', 'date', 'time',
    'dropdown', 'radio', 'checkbox', 'yes_no', 'temperature',
    'email', 'phone', 'rating', 'slider', 'label_heading',
];

interface Props {
    onSelect: (type: BuilderFieldType) => void;
    onClose: () => void;
}

export function FieldTypePicker({ onSelect, onClose }: Props) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-gray-300" />
                </div>

                <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Choose Field Type</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Select the type of input for this field</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 p-4 max-h-[55vh] overflow-y-auto pb-8">
                    {FIELD_TYPE_ORDER.map((type) => {
                        const cfg = FIELD_TYPE_CONFIG[type];
                        const { Icon } = cfg;
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => { onSelect(type); onClose(); }}
                                className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 text-center transition-all hover:scale-[1.03] active:scale-[0.97] ${cfg.bgColor} ${cfg.borderColor}`}
                            >
                                <div className={`${cfg.iconColor}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <span className={`text-xs font-bold leading-tight ${cfg.iconColor}`}>{cfg.label}</span>
                                <span className="text-[10px] text-gray-500 leading-tight">{cfg.description}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
