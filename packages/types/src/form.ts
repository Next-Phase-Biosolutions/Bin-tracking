// ─── Form Types ───────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'date' | 'time' | 'yes_no';

export type FormTriggerTypeValue =
    | 'on_arrival'
    | 'on_cycle_start'
    | 'scheduled'
    | 'manual'
    | 'inspection'
    | 'other';

export type FormFillFrequencyValue =
    | 'per_animal'
    | 'per_shift'
    | 'daily'
    | 'weekly'
    | 'as_needed';

export interface FormField {
    id: string;
    type: FieldType;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
    voiceEnabled?: boolean;
}

// ─── Standard Form (multi-section with optional conditional logic) ─────────

export interface ShowIfCondition {
    fieldId: string;
    values: string[];
}

export interface StandardSection {
    id: string;
    title: string | null;
    fields: FormField[];
    /** Multi-row table: column headers from paper form; workers add rows with Add row */
    tableColumns?: RepeatingColumn[];
    showIf?: ShowIfCondition;
}

export interface StandardSchema {
    formType: 'standard';
    sections: StandardSection[];
}

// ─── Checklist Form (grouped criteria, each with Yes/No + deviation) ────────

export interface ChecklistItem {
    id: string;
    label: string;
}

export interface ChecklistGroup {
    id: string;
    title: string;
    items: ChecklistItem[];
}

export interface ChecklistSchema {
    formType: 'checklist';
    headerFields: FormField[];
    groups: ChecklistGroup[];
}

// ─── Matrix Form (grid of rows × columns, each cell YES/NO + text) ──────────

export interface MatrixColumn {
    id: string;
    label: string;
}

export interface MatrixRow {
    id: string;
    label: string;
}

export interface MatrixSchema {
    formType: 'matrix';
    headerFields: FormField[];
    columns: MatrixColumn[];
    rows: MatrixRow[];
    footerFields?: FormField[];
}

// ─── Repeating Row Form (multi-row table, one row per entry) ─────────────────

export interface RepeatingColumn {
    id: string;
    type: FieldType;
    label: string;
    required: boolean;
    options?: string[];
    voiceEnabled?: boolean;
}

export interface RepeatingSchema {
    formType: 'repeating';
    instructions?: string;
    columns: RepeatingColumn[];
}

// ─── Discriminated union ──────────────────────────────────────────────────────

export type FormSchema = StandardSchema | ChecklistSchema | MatrixSchema | RepeatingSchema;

export type FormTypeValue = FormSchema['formType'];

export interface FormTemplate {
    id: string;
    title: string;
    description: string | null;
    stage: string;
    formType: FormTypeValue;
    schema: FormSchema;
    sourceImageUrl: string | null;
    triggerType: FormTriggerTypeValue | null;
    triggerConfig: Record<string, unknown> | null;
    fillFrequency: FormFillFrequencyValue | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

/** Draft returned from photo digitization before save */
export interface FormDigitizeDraft {
    title: string;
    description: string | null;
    formType: FormTypeValue;
    schema: FormSchema;
    warnings?: string[];
}
