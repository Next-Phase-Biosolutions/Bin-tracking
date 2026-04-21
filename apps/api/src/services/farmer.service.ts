import { AssemblyAI } from 'assemblyai';
import Anthropic from '@anthropic-ai/sdk';
import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { TranscribeAudioInput, AnimalRegistrationInput, ExtractedAnimalFields } from '@bin-tracker/validators';

const assemblyai = new AssemblyAI({
    apiKey: process.env['ASSEMBLYAI_API_KEY'] ?? '',
});

const anthropic = new Anthropic({
    apiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
});

export const farmerService = {
    /**
     * Transcribes audio with AssemblyAI, then extracts animal fields with Claude.
     * If targetField is set, only that field is returned (per-question mode).
     */
    async transcribeAndExtract(input: TranscribeAudioInput): Promise<{
        transcript: string;
        fields: Partial<ExtractedAnimalFields>;
    }> {
        // 1. Decode base64 audio to buffer
        const audioBuffer = Buffer.from(input.audioBase64, 'base64');

        // 2. Transcribe with AssemblyAI (upload buffer directly)
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

        // 3. Extract fields with Claude
        const fieldsList = input.targetField
            ? input.targetField
            : 'animalType, breed, age, weight, ownerName, healthCondition';

        const prompt = `You are extracting animal registration details from a farmer's spoken transcript.

Extract the following fields from the transcript: ${fieldsList}

Rules:
- Return ONLY a valid JSON object with these keys: animalType, breed, age, weight, ownerName, healthCondition
- If a field is not mentioned, return null for that field
- Keep values concise and natural (e.g. age: "3 years", weight: "250 kg")
- Do not add any explanation or text outside the JSON

Transcript: "${transcript}"`;

        let fields: Partial<ExtractedAnimalFields>;
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

            // Extract JSON from Claude's response
            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Could not parse field extraction from Claude response',
                });
            }

            const parsed = JSON.parse(jsonMatch[0]) as Record<string, string | null>;

            // If per-question mode, only return the requested field
            if (input.targetField) {
                fields = { [input.targetField]: parsed[input.targetField] ?? null };
            } else {
                fields = {
                    animalType: parsed['animalType'] ?? null,
                    breed: parsed['breed'] ?? null,
                    age: parsed['age'] ?? null,
                    weight: parsed['weight'] ?? null,
                    ownerName: parsed['ownerName'] ?? null,
                    healthCondition: parsed['healthCondition'] ?? null,
                };
            }
        } catch (err: unknown) {
            if (err instanceof TRPCError) throw err;
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Claude extraction error',
            });
        }

        return { transcript, fields };
    },

    /** Saves the reviewed animal registration to the database */
    async register(input: AnimalRegistrationInput): Promise<{ id: string }> {
        const record = await prisma.animalRegistration.create({
            data: {
                animalType: input.animalType,
                breed: input.breed,
                age: input.age,
                weight: input.weight,
                ownerName: input.ownerName,
                healthCondition: input.healthCondition,
                rawTranscript: input.rawTranscript,
            },
        });

        return { id: record.id };
    },
};
