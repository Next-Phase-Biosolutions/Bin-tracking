import { z } from 'zod';

// ─── Field Types ─────────────────────────────────────────────────────────────

export const fieldTypeSchema = z.enum(['text', 'textarea', 'number', 'select', 'radio', 'date', 'time', 'yes_no']);

export const formFieldSchema = z.object({
    id: z.string(),
    type: fieldTypeSchema,
    label: z.string(),
    required: z.boolean(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
});

// ─── Standard Schema ─────────────────────────────────────────────────────────

export const showIfConditionSchema = z.object({
    fieldId: z.string(),
    values: z.array(z.string()),
});

export const standardSectionSchema = z.object({
    id: z.string(),
    title: z.string().nullable(),
    fields: z.array(formFieldSchema),
    showIf: showIfConditionSchema.optional(),
});

export const standardSchemaSchema = z.object({
    formType: z.literal('standard'),
    sections: z.array(standardSectionSchema),
});

// ─── Checklist Schema ─────────────────────────────────────────────────────────

export const checklistItemSchema = z.object({
    id: z.string(),
    label: z.string(),
});

export const checklistGroupSchema = z.object({
    id: z.string(),
    title: z.string(),
    items: z.array(checklistItemSchema),
});

export const checklistSchemaSchema = z.object({
    formType: z.literal('checklist'),
    headerFields: z.array(formFieldSchema),
    groups: z.array(checklistGroupSchema),
});

// ─── Matrix Schema ────────────────────────────────────────────────────────────

export const matrixColumnSchema = z.object({
    id: z.string(),
    label: z.string(),
});

export const matrixRowSchema = z.object({
    id: z.string(),
    label: z.string(),
});

export const matrixSchemaSchema = z.object({
    formType: z.literal('matrix'),
    headerFields: z.array(formFieldSchema),
    columns: z.array(matrixColumnSchema),
    rows: z.array(matrixRowSchema),
    footerFields: z.array(formFieldSchema).optional(),
});

// ─── Repeating Schema ─────────────────────────────────────────────────────────

export const repeatingColumnSchema = z.object({
    id: z.string(),
    type: fieldTypeSchema,
    label: z.string(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
});

export const repeatingSchemaSchema = z.object({
    formType: z.literal('repeating'),
    instructions: z.string().optional(),
    columns: z.array(repeatingColumnSchema),
});

// ─── Discriminated Union ──────────────────────────────────────────────────────

export const formSchemaSchema = z.discriminatedUnion('formType', [
    standardSchemaSchema,
    checklistSchemaSchema,
    matrixSchemaSchema,
    repeatingSchemaSchema,
]);

// ─── API Input Schemas ────────────────────────────────────────────────────────

export const formListByStageSchema = z.object({
    stage: z.string().min(1),
});

export const formGetByIdSchema = z.object({
    id: z.string().cuid(),
});

export type FormListByStageInput = z.infer<typeof formListByStageSchema>;
export type FormGetByIdInput = z.infer<typeof formGetByIdSchema>;
