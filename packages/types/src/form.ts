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
    /**
     * Show this field only while another field in the same form holds one of
     * `values` — same shape and semantics as StandardSection.showIf, one level
     * down, so a follow-up question can sit directly under the answer that
     * triggers it (e.g. a comments box under a check answered "X Not
     * Completed"). Honoured by StandardFormRenderer; a hidden field is not
     * rendered and not validated.
     */
    showIf?: ShowIfCondition;
    /**
     * Seed a `date` field with today on a blank form — the paper equivalent of
     * a monitor writing the date at the top of the sheet. Opt-in per field, so
     * "Planned completion date" style fields stay empty. Ignored on any other
     * field type and when a past submission is being viewed or edited.
     */
    defaultToday?: boolean;
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

// ─── Form submission (persisted) ───────────────────────────────────────────────

/** One checklist item's answer + free-text follow-ups. Mirrors ChecklistFormRenderer's local ItemState. */
export interface ChecklistItemValue {
    answer: 'yes' | 'no' | null;
    deviation: string;
    corrective: string;
}

/** One matrix cell's answer + ingredient text. Mirrors MatrixFormRenderer's local CellState. */
export interface MatrixCellValue {
    answer: 'YES' | 'NO' | null;
    ingredient: string;
}

/** A repeating table row: columnId -> value. Mirrors SectionRepeatingTable's TableRow / RepeatingRowFormRenderer's Row. */
export type FormSubmissionTableRow = Record<string, string>;

/**
 * The persisted shape of a submitted form's `values`, discriminated on
 * `formType` exactly like `FormSchema` — each renderer holds a genuinely
 * different local state shape (confirmed by reading all four), so a
 * single flat `Record<string, string>` would silently lose data for 3 of
 * the 4 form types. Voice-confidence markers (flagged/blanket sets) are
 * deliberately NOT part of this — once a human hits Submit, the value is
 * accepted as-is.
 */
export type FormSubmissionValues =
    | {
          formType: 'standard';
          values: Record<string, string>;
          tableRows: Record<string, FormSubmissionTableRow[]>;
      }
    | {
          formType: 'checklist';
          headerValues: Record<string, string>;
          itemStates: Record<string, ChecklistItemValue>;
      }
    | {
          formType: 'matrix';
          headerValues: Record<string, string>;
          footerValues: Record<string, string>;
          cells: Record<string, MatrixCellValue>;
      }
    | {
          formType: 'repeating';
          rows: FormSubmissionTableRow[];
      };

export interface FormSubmission {
    id: string;
    formId: string;
    submittedByUserId: string | null;
    values: FormSubmissionValues;
    createdAt: Date;
}

export interface FormSubmissionAuditLog {
    id: string;
    submissionId: string;
    actorId: string | null;
    oldValue: FormSubmissionValues;
    newValue: FormSubmissionValues;
    createdAt: Date;
}

/** One row in the submissions list page — deliberately lighter than FormSubmission (no full `values`). */
export interface FormSubmissionListItem {
    id: string;
    formId: string;
    formTitle: string;
    /** Name of the logged-in user who submitted it; null when submitted without a user. */
    submittedByName: string | null;
    createdAt: Date;
}

/** Everything the detail/edit view needs in one response: the submission, its form's live title/schema (to render read-only or as an edit form), the submitter's name, and its full audit trail. */
export interface FormSubmissionDetail {
    submission: FormSubmission;
    formTitle: string;
    formSchema: FormSchema;
    submittedByName: string | null;
    auditLogs: FormSubmissionAuditLog[];
}
