import type { FormField, FormSchema, RepeatingColumn, StandardSchema, StandardSection } from '@bin-tracker/types';

const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'radio', 'date', 'time', 'yes_no'] as const;

function slugify(label: string): string {
    return (
        label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 48) || 'field'
    );
}

function normalizeColumn(col: Record<string, unknown>, index: number): RepeatingColumn {
    const label = String(col.label ?? `Column ${index + 1}`).trim();
    const typeRaw = String(col.type ?? 'text');
    const type = (FIELD_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as RepeatingColumn['type']) : 'text';
    const hasStar = label.includes('*');
    const required = typeof col.required === 'boolean' ? col.required : hasStar;
    return {
        id: typeof col.id === 'string' && col.id.trim() ? col.id : slugify(label) || `col_${index}`,
        type,
        label: label.replace(/\*+\s*$/, '').trim(),
        required,
        ...(Array.isArray(col.options) ? { options: col.options as string[] } : {}),
    };
}

function normalizeField(f: Record<string, unknown>, index: number): FormField {
    const label = String(f.label ?? `Field ${index + 1}`).trim();
    const typeRaw = String(f.type ?? 'text');
    const type = (FIELD_TYPES as readonly string[]).includes(typeRaw)
        ? (typeRaw as FormField['type'])
        : 'text';
    const hasStar = label.includes('*');
    const required = typeof f.required === 'boolean' ? f.required : hasStar;
    return {
        id: typeof f.id === 'string' && f.id.trim() ? f.id : slugify(label) || `field_${index}`,
        type,
        label: label.replace(/\*+\s*$/, '').trim(),
        required,
        ...(f.placeholder !== undefined ? { placeholder: String(f.placeholder) } : {}),
        ...(Array.isArray(f.options) ? { options: f.options as string[] } : {}),
    };
}

function ensureFieldIds(fields: FormField[], used: Set<string>): FormField[] {
    return fields.map((f, i) => {
        let id = f.id?.trim() || slugify(f.label) || `field_${i}`;
        while (used.has(id)) id = `${id}_${i}`;
        used.add(id);
        return { ...f, id };
    });
}

function ensureColumnIds(columns: RepeatingColumn[], used: Set<string>): RepeatingColumn[] {
    return columns.map((c, i) => {
        let id = c.id?.trim() || slugify(c.label) || `col_${i}`;
        while (used.has(id)) id = `${id}_${i}`;
        used.add(id);
        return { ...c, id };
    });
}

function enableVoice(f: FormField): FormField {
    return f.type === 'text' || f.type === 'textarea' ? { ...f, voiceEnabled: true } : f;
}

function enableVoiceColumn(c: RepeatingColumn): RepeatingColumn {
    return c.type === 'text' || c.type === 'textarea' ? { ...c, voiceEnabled: true } : c;
}

export function applyVoiceEnabledToSchema(schema: FormSchema): FormSchema {
    switch (schema.formType) {
        case 'standard':
            return {
                ...schema,
                sections: schema.sections.map((s) => ({
                    ...s,
                    fields: s.fields.map(enableVoice),
                    tableColumns: s.tableColumns?.map(enableVoiceColumn),
                })),
            };
        case 'checklist':
            return { ...schema, headerFields: schema.headerFields.map(enableVoice) };
        case 'matrix':
            return {
                ...schema,
                headerFields: schema.headerFields.map(enableVoice),
                footerFields: schema.footerFields?.map(enableVoice),
            };
        case 'repeating':
            return {
                ...schema,
                columns: schema.columns.map(enableVoiceColumn),
            };
    }
}

function fieldToColumn(f: FormField): RepeatingColumn {
    return {
        id: f.id,
        type: f.type,
        label: f.label,
        required: f.required,
        ...(f.options ? { options: f.options } : {}),
    };
}

function isVerificationSection(title: string | null): boolean {
    return (title ?? '').toLowerCase().includes('verification');
}

function isDeviationSection(title: string | null): boolean {
    return (title ?? '').toLowerCase().includes('deviation');
}

/** Header blanks above a verification grid (not table row columns) */
function isVerificationHeaderField(label: string): boolean {
    const l = label.toLowerCase();
    return /record review/.test(l) || /date onsite/.test(l);
}

/** Columns in the verification / deviation grid */
function isLikelyTableColumnField(label: string): boolean {
    const l = label.toLowerCase();
    if (l === 'date') return true;
    if (/species|number of animals|comments|initials/.test(l)) return true;
    if (/deviation|corrective|verify ca|welfare|water provided|feed|bedding|cleanliness|lighting|ventilation|damage/.test(l)) {
        return true;
    }
    return false;
}

function splitVerificationFields(fields: FormField[]): {
    headerFields: FormField[];
    tableFields: FormField[];
} {
    const headerFields: FormField[] = [];
    const tableFields: FormField[] = [];
    let headerInitials = 0;

    for (const f of fields) {
        const l = f.label.toLowerCase();
        if (isVerificationHeaderField(f.label)) {
            headerFields.push(f);
            continue;
        }
        if (l === 'initials' && headerInitials < 2 && headerFields.length > 0) {
            headerInitials += 1;
            headerFields.push(f);
            continue;
        }
        if (isLikelyTableColumnField(f.label) || /describe|corrective|verify/.test(l)) {
            tableFields.push(f);
            continue;
        }
        if (headerFields.length < 4) headerFields.push(f);
        else tableFields.push(f);
    }

    return { headerFields, tableFields };
}

function looksLikeContactFormFields(fields: FormField[]): boolean {
    const labels = fields.map((f) => f.label.toLowerCase());
    return (
        fields.length <= 6 &&
        labels.some((l) => /^(full )?name|email|phone|address|company|title$/.test(l)) &&
        !labels.some((l) => l === 'date' || /species|deviation|initials/.test(l))
    );
}

function coerceStandardSection(section: StandardSection, sectionCount: number): StandardSection {
    const title = section.title;
    const fields = [...section.fields];
    const tableColumns = section.tableColumns ? [...section.tableColumns] : undefined;

    if (tableColumns?.length && fields.length >= 3 && isVerificationSection(title)) {
        const split = splitVerificationFields(fields);
        if (split.tableFields.length >= 2) {
            return {
                ...section,
                fields: split.headerFields,
                tableColumns: [
                    ...tableColumns,
                    ...split.tableFields.map(fieldToColumn),
                ],
            };
        }
    }

    if (tableColumns?.length) return section;

    if (fields.length < 2) return section;

    if (looksLikeContactFormFields(fields)) return section;

    // Single-section upload that is only a grid → always a table
    if (sectionCount === 1 && fields.length >= 2) {
        return {
            ...section,
            fields: [],
            tableColumns: fields.map(fieldToColumn),
        };
    }

    if (isVerificationSection(title)) {
        const split = splitVerificationFields(fields);
        if (split.tableFields.length >= 2) {
            return {
                ...section,
                fields: split.headerFields,
                tableColumns: split.tableFields.map(fieldToColumn),
            };
        }
    }

    const looksLikeMonitoringRow =
        fields.length >= 4 &&
        fields.some((f) => f.label.toLowerCase() === 'date') &&
        fields.some((f) => /species|animal|welfare|comments/i.test(f.label));

    const shouldPromoteAllToTable =
        isDeviationSection(title) ||
        looksLikeMonitoringRow ||
        fields.length >= 3 ||
        (!title?.trim() && fields.length >= 2);

    if (shouldPromoteAllToTable) {
        return {
            ...section,
            fields: [],
            tableColumns: fields.map(fieldToColumn),
        };
    }

    return section;
}

/** Fix common Gemini mistakes: flat field lists that should be multi-row tables */
export function coerceStandardSectionsToTables(schema: StandardSchema): StandardSchema {
    const sectionCount = schema.sections.length;
    return {
        ...schema,
        sections: schema.sections.map((s) => coerceStandardSection(s, sectionCount)),
    };
}

/** One grid only, no extra fields → repeating form (single full-page table UI) */
export function maybePromoteSingleGridToRepeating(
    root: Record<string, unknown>,
): Record<string, unknown> {
    const schema = root.schema as Record<string, unknown> | undefined;
    if (!schema || schema.formType !== 'standard' || !Array.isArray(schema.sections)) {
        return root;
    }
    const sections = schema.sections as StandardSection[];
    if (sections.length !== 1) return root;

    const only = sections[0]!;
    const cols = only.tableColumns;
    if (!cols?.length || only.fields.length > 0) return root;

    const description =
        typeof root.description === 'string' ? root.description : null;

    return {
        ...root,
        formType: 'repeating',
        schema: {
            formType: 'repeating',
            instructions: description ?? undefined,
            columns: cols,
        },
    };
}

/** Fill gaps in Gemini digitization output before strict Zod validation */
export function normalizeDigitizedPayload(raw: unknown): unknown {
    if (!raw || typeof raw !== 'object') return raw;
    const root = raw as Record<string, unknown>;
    const schemaRaw = root.schema;
    if (!schemaRaw || typeof schemaRaw !== 'object') return raw;

    const schema = schemaRaw as Record<string, unknown>;
    const title =
        typeof root.title === 'string' && root.title.trim() ? root.title : 'Untitled Form';

    // ─── Repeating (single table) ───
    if (schema.formType === 'repeating' && Array.isArray(schema.columns)) {
        const columns = schema.columns.map((c, i) => normalizeColumn(c as Record<string, unknown>, i));
        return {
            ...root,
            title,
            formType: 'repeating',
            schema: {
                formType: 'repeating',
                instructions:
                    typeof schema.instructions === 'string' ? schema.instructions : undefined,
                columns,
            },
        };
    }

    // ─── Standard (sections with fields and/or tableColumns) ───
    if (schema.formType === 'standard' && Array.isArray(schema.sections)) {
        const sections = schema.sections.map((section, si) => {
            const sec = section as Record<string, unknown>;
            const fields = Array.isArray(sec.fields)
                ? sec.fields.map((f, fi) => normalizeField(f as Record<string, unknown>, fi))
                : [];
            const tableColumns = Array.isArray(sec.tableColumns)
                ? sec.tableColumns.map((c, ci) =>
                      normalizeColumn(c as Record<string, unknown>, ci),
                  )
                : undefined;

            return {
                id: typeof sec.id === 'string' && sec.id.trim() ? sec.id : `section_${si + 1}`,
                title: sec.title === undefined ? null : sec.title,
                fields,
                ...(tableColumns?.length ? { tableColumns } : {}),
                ...(sec.showIf !== undefined ? { showIf: sec.showIf } : {}),
            };
        });

        const coerced = coerceStandardSectionsToTables({
            formType: 'standard',
            sections: sections as StandardSection[],
        });

        const withTables = {
            ...root,
            title,
            formType: 'standard',
            schema: coerced,
        };

        return maybePromoteSingleGridToRepeating(withTables);
    }

    return raw;
}

export function generateFieldIds(schema: FormSchema): FormSchema {
    const used = new Set<string>();

    if (schema.formType === 'standard') {
        return {
            ...schema,
            sections: schema.sections.map((s) => ({
                ...s,
                id: s.id || slugify(s.title ?? 'section'),
                fields: ensureFieldIds(s.fields, used),
                tableColumns: s.tableColumns
                    ? ensureColumnIds(s.tableColumns, used)
                    : undefined,
            })),
        };
    }

    if (schema.formType === 'checklist') {
        return {
            ...schema,
            headerFields: ensureFieldIds(schema.headerFields, used),
            groups: schema.groups.map((g) => ({
                ...g,
                items: g.items.map((it, i) => ({
                    ...it,
                    id: it.id || slugify(it.label) || `item_${i}`,
                })),
            })),
        };
    }

    if (schema.formType === 'matrix') {
        return {
            ...schema,
            headerFields: ensureFieldIds(schema.headerFields, used),
            footerFields: schema.footerFields ? ensureFieldIds(schema.footerFields, used) : undefined,
        };
    }

    if (schema.formType === 'repeating') {
        return {
            ...schema,
            columns: ensureColumnIds(schema.columns, used),
        };
    }

    return schema;
}
