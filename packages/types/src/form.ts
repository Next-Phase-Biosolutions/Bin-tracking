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

// ─── Whole-form voice fill ────────────────────────────────────────────────────

/**
 * A single value extracted from speech.
 *
 * `source` distinguishes a value the speaker named outright from one expanded
 * out of a spoken blanket ("everything else is compliant") — only the latter is
 * surfaced in the review banner. Absent means spoken.
 */
export interface VoiceFilledValue {
    value: string;
    confidence: 'high' | 'low';
    source?: 'spoken' | 'blanket';
}

/**
 * The single repeating-form table has no section id, so its appended row is
 * keyed under this sentinel in `FormVoiceFillResult.tableRows`.
 */
export const VOICE_FILL_REPEATING_KEY = '__repeating__';

/**
 * Checklist items and matrix cells have no flat field id, so voice fill routes
 * them through `FormVoiceFillResult.fields` under these composite keys. The
 * service builds them and the renderers decode them — keep both sides here.
 */
export const voiceKeys = {
    checklistAnswer: (itemId: string) => itemId,
    checklistDeviation: (itemId: string) => `${itemId}__deviation`,
    checklistCorrective: (itemId: string) => `${itemId}__corrective`,
    /** Matches MatrixFormRenderer's own cell key, so the renderer maps 1:1. */
    matrixCell: (rowId: string, colId: string) => `${rowId}__${colId}`,
    matrixIngredient: (rowId: string, colId: string) => `${rowId}__${colId}__ingredient`,
} as const;

/** Result of one whole-form voice fill: header field values + one row per table. */
export interface FormVoiceFillResult {
    transcript: string;
    /** Flat field fills: fieldId -> value (standard sections' `fields`). */
    fields: Record<string, VoiceFilledValue>;
    /**
     * One appended table row per table. Key = section id (standard table
     * sections) or `VOICE_FILL_REPEATING_KEY` (the single repeating table).
     * Inner map = columnId -> value.
     */
    tableRows: Record<string, Record<string, VoiceFilledValue>>;
}
