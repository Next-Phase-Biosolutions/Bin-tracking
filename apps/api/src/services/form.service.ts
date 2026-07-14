import { AssemblyAI } from 'assemblyai';
import Anthropic from '@anthropic-ai/sdk';
import { TRPCError } from '@trpc/server';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FormTemplate, FormDigitizeDraft } from '@bin-tracker/types';
import type { FormCreateInput, FormTranscribeFieldInput } from '@bin-tracker/validators';
import { formSchemaSchema } from '@bin-tracker/validators';
import { applyVoiceEnabledToSchema, generateFieldIds } from '../lib/form-schema-utils.js';
import { formDigitizeService } from './form-digitize.service.js';

const assemblyai = new AssemblyAI({
    apiKey: process.env['ASSEMBLYAI_API_KEY'] ?? '',
});

const anthropic = new Anthropic({
    apiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
});

function toFormTemplate(raw: {
    id: string;
    title: string;
    description: string | null;
    stage: string;
    formType: string;
    schema: unknown;
    sourceImageUrl: string | null;
    triggerType: string | null;
    triggerConfig: unknown;
    fillFrequency: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}): FormTemplate {
    return {
        id: raw.id,
        title: raw.title,
        description: raw.description,
        stage: raw.stage,
        formType: raw.formType as FormTemplate['formType'],
        schema: raw.schema as FormTemplate['schema'],
        sourceImageUrl: raw.sourceImageUrl,
        triggerType: raw.triggerType as FormTemplate['triggerType'],
        triggerConfig: (raw.triggerConfig as Record<string, unknown> | null) ?? null,
        fillFrequency: raw.fillFrequency as FormTemplate['fillFrequency'],
        isActive: raw.isActive,
        sortOrder: raw.sortOrder,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    };
}

export const formService = {
    async listByStage(prisma: PrismaClient, stage: string): Promise<FormTemplate[]> {
        const rows = await prisma.formTemplate.findMany({
            where: stage && stage !== 'ALL' ? { stage, isActive: true } : { isActive: true },
            orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
        });
        return rows.map(toFormTemplate);
    },

    async getById(prisma: PrismaClient, id: string): Promise<FormTemplate | null> {
        const row = await prisma.formTemplate.findUnique({ where: { id } });
        if (!row) return null;
        return toFormTemplate(row);
    },

    async digitizeFromPhoto(imageBase64: string, mimeType: string): Promise<FormDigitizeDraft> {
        return formDigitizeService.digitizeFromPhoto(imageBase64, mimeType);
    },

    async refineFromRegion(
        imageBase64: string,
        draft: FormDigitizeDraft,
        mimeType: string,
        userNote?: string,
    ): Promise<FormDigitizeDraft> {
        return formDigitizeService.refineFromRegion(imageBase64, draft, mimeType, userNote);
    },

    async create(prisma: PrismaClient, input: FormCreateInput, organizationId: string): Promise<FormTemplate> {
        const parsed = formSchemaSchema.safeParse(input.schema);
        if (!parsed.success) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Invalid form schema: ${parsed.error.message}`,
            });
        }

        let schema = generateFieldIds(parsed.data);
        schema = applyVoiceEnabledToSchema(schema);

        const maxSort = await prisma.formTemplate.aggregate({
            where: { stage: input.stage },
            _max: { sortOrder: true },
        });

        const row = await prisma.formTemplate.create({
            data: {
                title: input.title,
                description: input.description ?? null,
                stage: input.stage,
                formType: input.formType,
                schema: schema as unknown as Prisma.InputJsonValue,
                sourceImageUrl: input.sourceImageUrl ?? null,
                triggerType: input.triggerType,
                fillFrequency: input.fillFrequency,
                triggerConfig: (input.triggerConfig ?? undefined) as Prisma.InputJsonValue | undefined,
                sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
                organizationId,
            },
        });

        return toFormTemplate(row);
    },

    async transcribeField(input: FormTranscribeFieldInput): Promise<{ value: string | null }> {
        const audioBuffer = Buffer.from(input.audioBase64, 'base64');

        let transcript: string;
        try {
            const result = await assemblyai.transcripts.transcribe({
                audio: audioBuffer,
                speech_models: ['universal-3-pro'],
            });

            if (result.status === 'error' || !result.text) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Transcription failed — no speech detected or audio unclear',
                });
            }
            transcript = result.text;
        } catch (err: unknown) {
            if (err instanceof TRPCError) throw err;
            const msg = err instanceof Error ? err.message : String(err);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `AssemblyAI transcription error: ${msg}`,
            });
        }

        const prompt = `Extract the value for a single form field from a spoken transcript.

Field label: "${input.fieldLabel}"
Field type: ${input.fieldType ?? 'text'}

Rules:
- Return ONLY a valid JSON object: { "value": "..." }
- Use null if the field was not mentioned
- Keep values concise and natural (e.g. dates as spoken, numbers with units if given)
- For yes_no fields use "Yes" or "No"

Transcript: "${transcript}"`;

        try {
            const message = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 256,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = message.content[0];
            if (content?.type !== 'text') {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Claude returned unexpected response format',
                });
            }

            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Could not parse field value from Claude response',
                });
            }

            const parsed = JSON.parse(jsonMatch[0]) as { value?: string | null };
            return { value: parsed.value ?? null };
        } catch (err: unknown) {
            if (err instanceof TRPCError) throw err;
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Claude field extraction error',
            });
        }
    },
};
