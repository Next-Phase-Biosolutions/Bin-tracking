// ─── Form Types ───────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'date' | 'time' | 'yes_no';

export interface FormField {
    id: string;
    type: FieldType;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
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
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
