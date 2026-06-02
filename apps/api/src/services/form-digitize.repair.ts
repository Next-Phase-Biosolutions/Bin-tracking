import type {
    FormDigitizeDraft,
    FormField,
    RepeatingColumn,
    StandardSchema,
    StandardSection,
} from '@bin-tracker/types';

/** Canonical monitoring grid (11 columns) — Feeding and Watering Livestock */
export const LIVESTOCK_MONITORING_COLUMNS: RepeatingColumn[] = [
    { id: 'date', type: 'date', label: 'Date', required: false },
    { id: 'species', type: 'text', label: 'Species', required: false },
    { id: 'number_of_animals', type: 'number', label: 'Number of animals', required: false },
    {
        id: 'no_damage',
        type: 'yes_no',
        label: 'No damage, debris, sharp edges that could cause injury',
        required: false,
    },
    {
        id: 'cleanliness',
        type: 'yes_no',
        label: 'Cleanliness of pens & equip',
        required: false,
    },
    {
        id: 'lighting_ventilation',
        type: 'yes_no',
        label: 'Lighting & ventilation functioning',
        required: false,
    },
    { id: 'welfare_conditions', type: 'yes_no', label: 'Welfare conditions', required: false },
    { id: 'water_provided', type: 'time', label: 'Water provided', required: false },
    { id: 'feed_bedding', type: 'time', label: 'Feed & bedding', required: false },
    { id: 'comments', type: 'textarea', label: 'Comments', required: false },
    { id: 'initials', type: 'text', label: 'Initials', required: false },
];

export const LIVESTOCK_DEVIATIONS_COLUMNS: RepeatingColumn[] = [
    { id: 'date', type: 'date', label: 'Date', required: false },
    {
        id: 'description',
        type: 'textarea',
        label: 'Description of deviation / cause',
        required: false,
    },
    { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions', required: false },
    { id: 'planned_completion_date', type: 'date', label: 'Planned completion date', required: false },
    { id: 'verify_ca', type: 'text', label: 'Verify CA', required: false },
    { id: 'initials', type: 'text', label: 'Initials', required: false },
];

export const LIVESTOCK_VERIFICATION_FIELDS: FormField[] = [
    { id: 'date_record_review', type: 'date', label: 'Date Record Review', required: false },
    { id: 'initials_review', type: 'text', label: 'Initials', required: false },
    { id: 'date_onsite', type: 'date', label: 'Date onsite', required: false },
    { id: 'initials_onsite', type: 'text', label: 'Initials', required: false },
];

export const LIVESTOCK_VERIFICATION_TABLE_COLUMNS: RepeatingColumn[] = [
    { id: 'date', type: 'date', label: 'Date', required: false },
    {
        id: 'describe_deviation',
        type: 'textarea',
        label: 'Describe deviation / cause',
        required: false,
    },
    {
        id: 'corrective_actions',
        type: 'textarea',
        label: 'Corrective Actions / Planned Completion Date',
        required: false,
    },
    { id: 'verify_ca', type: 'text', label: 'Verify CA', required: false },
    { id: 'initials', type: 'text', label: 'Initials', required: false },
];

const LIVESTOCK_DEVIATIONS_TITLE =
    'Deviations: document actions taken below or complete a separate Deviation Log';

function normLabel(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function labelsMatch(a: string, b: string): boolean {
    const na = normLabel(a);
    const nb = normLabel(b);
    if (na === nb) return true;
    if (na.length >= 8 && nb.length >= 8 && (na.includes(nb) || nb.includes(na))) return true;
    return false;
}

function mergeTableColumns(
    existing: RepeatingColumn[],
    canonical: RepeatingColumn[],
    warnings: string[],
): RepeatingColumn[] {
    const extras = existing.filter(
        (c) => !canonical.some((can) => labelsMatch(c.label, can.label)),
    );
    const merged: RepeatingColumn[] = [];

    for (const can of canonical) {
        const match = existing.find((c) => labelsMatch(c.label, can.label));
        if (match) {
            merged.push({ ...can, id: match.id, label: match.label });
        } else {
            merged.push({ ...can });
            warnings.push(`Added missing table column: ${can.label}`);
        }
    }

    return [...merged, ...extras];
}

export function isLikelyLivestockForm(draft: FormDigitizeDraft): boolean {
    const blob = `${draft.title} ${draft.description ?? ''}`.toLowerCase();
    if (/feeding|watering|livestock|est\s*183/.test(blob)) return true;

    if (draft.schema.formType !== 'standard') return false;

    const maxTableCols = Math.max(
        0,
        ...draft.schema.sections.map((s) => {
            if (isDeviationSection(s) || isVerificationSection(s)) return 0;
            return s.tableColumns?.length ?? (s.fields.length >= 4 ? s.fields.length : 0);
        }),
    );
    return (
        maxTableCols >= 6 &&
        /monitoring|deviation|species|animal|welfare|pen|housing/.test(blob)
    );
}

function isDeviationSection(s: StandardSection): boolean {
    return (s.title ?? '').toLowerCase().includes('deviation');
}

function isVerificationSection(s: StandardSection): boolean {
    return (s.title ?? '').toLowerCase().includes('verification');
}

function findMonitoringSectionIndex(sections: StandardSection[]): number {
    let best = -1;
    let bestCols = 0;
    for (let i = 0; i < sections.length; i++) {
        const s = sections[i]!;
        if (isDeviationSection(s) || isVerificationSection(s)) continue;
        const n = s.tableColumns?.length ?? 0;
        const fieldScore = s.fields.length >= 4 ? s.fields.length : 0;
        const score = n || fieldScore;
        if (score > bestCols) {
            bestCols = score;
            best = i;
        }
    }
    return best;
}

function repairMonitoringSection(sections: StandardSection[], warnings: string[]): StandardSection[] {
    const next = [...sections];
    let idx = findMonitoringSectionIndex(next);

    if (idx === -1) {
        warnings.push('Added main monitoring table (11 columns).');
        next.unshift({
            id: 'monitoring_log',
            title: null,
            fields: [],
            tableColumns: [...LIVESTOCK_MONITORING_COLUMNS],
        });
        return next;
    }

    const sec = next[idx]!;
    let tableColumns = sec.tableColumns ?? [];

    if (tableColumns.length === 0 && sec.fields.length >= 3) {
        tableColumns = sec.fields.map((f) => ({
            id: f.id,
            type: f.type,
            label: f.label,
            required: f.required,
            ...(f.options ? { options: f.options } : {}),
        }));
        warnings.push('Converted monitoring fields into a multi-row table.');
    }

    let merged: RepeatingColumn[];
    if (tableColumns.length > 0 && tableColumns.length < 8) {
        merged = [...LIVESTOCK_MONITORING_COLUMNS];
        warnings.push(
            'Rebuilt the main monitoring table with all 11 columns (AI returned an incomplete grid).',
        );
    } else {
        merged = mergeTableColumns(tableColumns, LIVESTOCK_MONITORING_COLUMNS, warnings);
    }
    next[idx] = {
        ...sec,
        fields: [],
        tableColumns: merged,
    };
    return next;
}

function ensureDeviationsSection(sections: StandardSection[], warnings: string[]): StandardSection[] {
    const next = [...sections];
    let idx = next.findIndex(isDeviationSection);

    if (idx === -1) {
        warnings.push('Added deviations table section.');
        next.push({
            id: 'deviations',
            title: LIVESTOCK_DEVIATIONS_TITLE,
            fields: [],
            tableColumns: [...LIVESTOCK_DEVIATIONS_COLUMNS],
        });
        return next;
    }

    const sec = next[idx]!;
    let tableColumns = sec.tableColumns ?? [];
    if (tableColumns.length === 0 && sec.fields.length >= 2) {
        tableColumns = sec.fields.map((f) => ({
            id: f.id,
            type: f.type,
            label: f.label,
            required: f.required,
        }));
        warnings.push('Converted deviations fields into a multi-row table.');
    }

    let devCols = tableColumns;
    if (devCols.length > 0 && devCols.length < 5) {
        devCols = [...LIVESTOCK_DEVIATIONS_COLUMNS];
        warnings.push('Rebuilt the deviations table with all 6 columns.');
    } else {
        devCols = mergeTableColumns(devCols, LIVESTOCK_DEVIATIONS_COLUMNS, warnings);
    }
    next[idx] = {
        ...sec,
        title: sec.title ?? LIVESTOCK_DEVIATIONS_TITLE,
        fields: [],
        tableColumns: devCols,
    };
    return next;
}

function mergeVerificationFields(existing: FormField[], warnings: string[]): FormField[] {
    const merged: FormField[] = [];
    for (const can of LIVESTOCK_VERIFICATION_FIELDS) {
        const match = existing.find((f) => labelsMatch(f.label, can.label));
        if (match) merged.push(match);
        else {
            merged.push({ ...can });
            warnings.push(`Added verification field: ${can.label}`);
        }
    }
    return merged;
}

function ensureVerificationSection(sections: StandardSection[], warnings: string[]): StandardSection[] {
    const next = [...sections];
    let idx = next.findIndex(isVerificationSection);

    if (idx === -1) {
        warnings.push('Added verification section (header fields + table).');
        next.push({
            id: 'verification',
            title: 'Verification: X/Month record review and X2/Year onsite observations by Plant Manager or designate',
            fields: [...LIVESTOCK_VERIFICATION_FIELDS],
            tableColumns: [...LIVESTOCK_VERIFICATION_TABLE_COLUMNS],
        });
        return next;
    }

    const sec = next[idx]!;
    let fields = sec.fields;
    let tableColumns = sec.tableColumns ?? [];

    if (tableColumns.length === 0 && fields.length >= 3) {
        const splitFields: FormField[] = [];
        const tableFields: FormField[] = [];
        for (const f of fields) {
            const l = f.label.toLowerCase();
            if (/record review|date onsite/.test(l)) splitFields.push(f);
            else if (/describe|corrective|verify ca/.test(l) || l === 'date') tableFields.push(f);
            else if (splitFields.length < 4) splitFields.push(f);
            else tableFields.push(f);
        }
        fields = splitFields;
        tableColumns = tableFields.map((f) => ({
            id: f.id,
            type: f.type,
            label: f.label,
            required: f.required,
        }));
        warnings.push('Split verification into header fields and a table grid.');
    }

    next[idx] = {
        ...sec,
        fields: mergeVerificationFields(fields, warnings),
        tableColumns: mergeTableColumns(
            tableColumns,
            LIVESTOCK_VERIFICATION_TABLE_COLUMNS,
            warnings,
        ),
    };
    return next;
}

/** Align digitized draft with livestock mockup structure (multi-row tables) */
export function repairDigitizedDraft(draft: FormDigitizeDraft): FormDigitizeDraft {
    if (!isLikelyLivestockForm(draft)) return draft;

    if (draft.schema.formType !== 'standard') {
        return draft;
    }

    const warnings = [...(draft.warnings ?? [])];
    let sections = draft.schema.sections;
    sections = repairMonitoringSection(sections, warnings);
    sections = ensureDeviationsSection(sections, warnings);
    sections = ensureVerificationSection(sections, warnings);

    const schema: StandardSchema = { formType: 'standard', sections };
    return {
        ...draft,
        formType: 'standard',
        schema,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}
