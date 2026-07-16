import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    standardSchemaSchema,
    repeatingSchemaSchema,
} from '@bin-tracker/validators';
import type { FormDigitizeDraft, FormTypeValue } from '@bin-tracker/types';
import { PLAN_LIMITS } from '@bin-tracker/types';
import { prisma } from '@bin-tracker/db';
import { FORM_DIGITIZE_SYSTEM_PROMPT } from './form-digitize.prompt.js';
import { repairDigitizedDraft } from './form-digitize.repair.js';
import { generateFieldIds, normalizeDigitizedPayload } from '../lib/form-schema-utils.js';
import { usageService } from './usage.service.js';

/**
 * Second, independent check that runs after requireModule('FORMS_AI_DIGITIZE')
 * has already gated whether the org can use this feature at all — this is
 * "how much have they used this month". Same Subscription.plan lookup
 * pattern as facility.service.ts / employee.service.ts's quantity limits.
 */
async function meterDigitize(orgId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({ where: { orgId } });
    const limit = subscription ? PLAN_LIMITS[subscription.plan].monthlyDigitize : -1;
    await usageService.checkAndIncrement(orgId, 'form_digitize', limit);
}

/** Vision-capable models; tried in order when primary is unavailable/over-quota */
const DIGITIZE_MODEL_FALLBACKS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
] as const;

const digitizeResponseSchema = z.discriminatedUnion('formType', [
    z.object({
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        formType: z.literal('standard'),
        schema: standardSchemaSchema,
    }),
    z.object({
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        formType: z.literal('repeating'),
        schema: repeatingSchemaSchema,
    }),
]);

function getApiKey(): string {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'GEMINI_API_KEY is not configured',
        });
    }
    return apiKey;
}

function buildModelChain(): string[] {
    const primary = process.env['FORM_DIGITIZE_MODEL'] ?? 'gemini-2.0-flash';
    const chain = [primary, ...DIGITIZE_MODEL_FALLBACKS.filter((m) => m !== primary)];
    return [...new Set(chain)];
}

function isModelAccessError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return (
        msg.includes('403') ||
        msg.includes('404') ||
        msg.includes('429') ||
        msg.includes('denied access') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('not found') ||
        msg.includes('quota') ||
        msg.includes('Quota') ||
        msg.includes('Too Many Requests') ||
        msg.includes('RESOURCE_EXHAUSTED')
    );
}

function createModel(modelName: string): GenerativeModel {
    const genAI = new GoogleGenerativeAI(getApiKey());
    return genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: FORM_DIGITIZE_SYSTEM_PROMPT,
        generationConfig: {
            responseMimeType: 'application/json',
        },
    });
}

function parseJsonFromText(text: string): unknown {
    const trimmed = text.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fence ? fence[1]!.trim() : trimmed;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
        throw new Error('No JSON object in model response');
    }
    return JSON.parse(raw.slice(start, end + 1));
}

function parseVisionResponse(text: string): FormDigitizeDraft {
    let parsed: unknown;
    try {
        parsed = parseJsonFromText(text);
    } catch {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to parse digitization JSON from Gemini',
        });
    }
    const normalized = normalizeDigitizedPayload(parsed);
    const validated = digitizeResponseSchema.safeParse(normalized);
    if (!validated.success) {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Digitized schema invalid: ${validated.error.message}`,
        });
    }
    const data = validated.data;
    const repaired = repairDigitizedDraft({
        title: data.title,
        description: data.description ?? null,
        formType: data.formType as FormTypeValue,
        schema: data.schema,
    });
    const schema = generateFieldIds(repaired.schema);
    return {
        title: repaired.title,
        description: repaired.description ?? null,
        formType: repaired.formType,
        schema,
        warnings: repaired.warnings,
    };
}

async function generateWithModel(
    modelName: string,
    imageBase64: string,
    mimeType: string,
    userText: string,
): Promise<FormDigitizeDraft> {
    const model = createModel(modelName);
    const result = await model.generateContent([
        { text: userText },
        { inlineData: { mimeType, data: imageBase64 } },
    ]);
    return parseVisionResponse(result.response.text());
}

async function runVision(
    imageBase64: string,
    mimeType: string,
    userText: string,
): Promise<FormDigitizeDraft> {
    const models = buildModelChain();
    let lastError: unknown;

    for (const modelName of models) {
        try {
            return await generateWithModel(modelName, imageBase64, mimeType, userText);
        } catch (err) {
            if (err instanceof TRPCError && err.code !== 'INTERNAL_SERVER_ERROR') {
                throw err;
            }
            if (isModelAccessError(err)) {
                lastError = err;
                continue;
            }
            throw err;
        }
    }

    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Gemini digitization failed (tried ${models.join(', ')}): ${msg}. Create a new key at https://aistudio.google.com/apikey and set FORM_DIGITIZE_MODEL=gemini-2.0-flash in .env`,
    });
}

export const formDigitizeService = {
    async digitizeFromPhoto(imageBase64: string, orgId: string, mimeType = 'image/jpeg'): Promise<FormDigitizeDraft> {
        await meterDigitize(orgId);
        const prompt =
            'Digitize this paper form. Any rectangular GRID (header row + empty data rows, same number of columns in each row) must become a TABLE: tableColumns with fields:[] (or formType repeating if the whole page is one grid only). Count vertical grid lines for column count. Never output grid columns as a vertical list of fields. Include every sub-column under grouped headers. Put intro text in description.';
        try {
            return await runVision(imageBase64, mimeType, prompt);
        } catch (err) {
            if (err instanceof TRPCError) throw err;
            try {
                return await runVision(
                    imageBase64,
                    mimeType,
                    'Digitize this form. Detect all tables. Return strict JSON only.',
                );
            } catch (retryErr) {
                const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Gemini digitization failed: ${msg}`,
                });
            }
        }
    },

    async refineFromRegion(
        imageBase64: string,
        draft: FormDigitizeDraft,
        orgId: string,
        mimeType = 'image/jpeg',
        userNote?: string,
    ): Promise<FormDigitizeDraft> {
        await meterDigitize(orgId);
        const note = userNote ? `\nUser note: ${userNote}` : '';
        const prompt = `This image is a cropped region of a form. Update ONLY the affected parts of this draft JSON:\n${JSON.stringify(draft)}${note}\nReturn the full updated JSON object. Preserve table/repeating structure.`;
        try {
            return await runVision(imageBase64, mimeType, prompt);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Gemini refine failed: ${msg}`,
            });
        }
    },
};
