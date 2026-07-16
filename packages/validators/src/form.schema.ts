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
    voiceEnabled: z.boolean().optional(),
});

// ─── Repeating column (shared by repeating forms & standard table sections) ───

export const repeatingColumnSchema = z.object({
    id: z.string(),
    type: fieldTypeSchema,
    label: z.string(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    voiceEnabled: z.boolean().optional(),
});

// ─── Standard Schema ─────────────────────────────────────────────────────────

export const showIfConditionSchema = z.object({
    fieldId: z.string(),
    values: z.array(z.string()),
});

export const standardSectionSchema = z
    .object({
        id: z.string(),
        title: z.string().nullable(),
        fields: z.array(formFieldSchema).default([]),
        tableColumns: z.array(repeatingColumnSchema).optional(),
        showIf: showIfConditionSchema.optional(),
    })
    .refine((s) => s.fields.length > 0 || (s.tableColumns?.length ?? 0) > 0, {
        message: 'Each section needs fields or tableColumns',
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

// ─── Photo import & create ────────────────────────────────────────────────────

export const formTriggerTypeSchema = z.enum([
    'on_arrival',
    'on_cycle_start',
    'scheduled',
    'manual',
    'inspection',
    'other',
]);

export const formFillFrequencySchema = z.enum([
    'per_animal',
    'per_shift',
    'daily',
    'weekly',
    'as_needed',
]);

/**
 * ~10.5MB of binary image (base64 inflates by 4/3) — generous for a phone
 * photo of a paper form, while keeping oversized payloads out of the Redis
 * job queue (the digitize job stores the image in job data). The global
 * Fastify bodyLimit (20MB) is the outer bound; this is the per-field one.
 */
const IMAGE_BASE64_MAX_CHARS = 14 * 1024 * 1024;
/** Only formats Gemini vision actually accepts here — never a free-form string. */
const imageMimeType = z.enum(['image/jpeg', 'image/png', 'image/webp']);

export const formDigitizeFromPhotoSchema = z.object({
    imageBase64: z.string().min(1).max(IMAGE_BASE64_MAX_CHARS),
    mimeType: imageMimeType.default('image/jpeg'),
});

/** Input for polling the status of an async `form.digitizeFromPhoto` job. */
export const formDigitizeJobStatusSchema = z.object({
    jobId: z.string().min(1),
});

export const formRefineRegionSchema = z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
});

export const formRefineFromRegionSchema = z.object({
    imageBase64: z.string().min(1).max(IMAGE_BASE64_MAX_CHARS),
    mimeType: imageMimeType.default('image/jpeg'),
    currentDraft: z.object({
        title: z.string(),
        description: z.string().nullable().optional(),
        formType: z.enum(['standard', 'checklist', 'matrix', 'repeating']),
        schema: formSchemaSchema,
        warnings: z.array(z.string()).optional(),
    }),
    region: formRefineRegionSchema.optional(),
    userNote: z.string().optional(),
});

export const formCreateSchema = z.object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    stage: z.string().min(1),
    formType: z.enum(['standard', 'checklist', 'matrix', 'repeating']),
    schema: formSchemaSchema,
    triggerType: formTriggerTypeSchema,
    fillFrequency: formFillFrequencySchema,
    sourceImageUrl: z.string().nullable().optional(),
    triggerConfig: z.record(z.unknown()).optional(),
});

export const formTranscribeFieldSchema = z.object({
    audioBase64: z.string().min(1),
    mimeType: z.string().default('audio/webm'),
    fieldId: z.string(),
    fieldLabel: z.string(),
    fieldType: fieldTypeSchema.optional(),
});

export type FormListByStageInput = z.infer<typeof formListByStageSchema>;
export type FormGetByIdInput = z.infer<typeof formGetByIdSchema>;
export type FormDigitizeFromPhotoInput = z.infer<typeof formDigitizeFromPhotoSchema>;
export type FormDigitizeJobStatusInput = z.infer<typeof formDigitizeJobStatusSchema>;
export type FormRefineFromRegionInput = z.infer<typeof formRefineFromRegionSchema>;
export type FormCreateInput = z.infer<typeof formCreateSchema>;
export type FormTranscribeFieldInput = z.infer<typeof formTranscribeFieldSchema>;
