import { z } from 'zod';

export const transcribeAudioSchema = z.object({
    /** Base64-encoded audio blob from the browser */
    audioBase64: z.string().min(1, 'Audio data is required'),
    /** Audio MIME type — webm (Chrome/Firefox) or mp4 (iOS Safari) */
    mimeType: z.enum(['audio/webm', 'audio/mp4']),
    /** If set, only extract this one field from the transcript */
    targetField: z
        .enum(['animalType', 'breed', 'age', 'weight', 'ownerName', 'healthCondition'])
        .optional(),
});

export type TranscribeAudioInput = z.infer<typeof transcribeAudioSchema>;

export const animalRegistrationSchema = z.object({
    animalType: z.string().min(1, 'Animal type is required'),
    breed: z.string().optional(),
    age: z.string().optional(),
    weight: z.string().optional(),
    ownerName: z.string().min(1, 'Owner name is required'),
    healthCondition: z.string().optional(),
    rawTranscript: z.string().optional(),
});

export type AnimalRegistrationInput = z.infer<typeof animalRegistrationSchema>;

export const extractedAnimalFieldsSchema = z.object({
    animalType: z.string().nullable(),
    breed: z.string().nullable(),
    age: z.string().nullable(),
    weight: z.string().nullable(),
    ownerName: z.string().nullable(),
    healthCondition: z.string().nullable(),
});

export type ExtractedAnimalFields = z.infer<typeof extractedAnimalFieldsSchema>;
