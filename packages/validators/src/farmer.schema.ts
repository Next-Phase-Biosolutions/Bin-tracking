import { z } from 'zod';

export const transcribeAudioSchema = z.object({
    /** Base64-encoded audio blob from the browser */
    audioBase64: z.string().min(1, 'Audio data is required'),
    /** Audio MIME type — webm (Chrome/Firefox) or mp4 (iOS Safari) */
    mimeType: z.enum(['audio/webm', 'audio/mp4']),
    /** If set, only extract this one field from the transcript */
    targetField: z
        .enum(['animalType', 'breed', 'age', 'weight', 'plantId', 'employeeReceived', 'healthCondition'])
        .optional(),
});

export type TranscribeAudioInput = z.infer<typeof transcribeAudioSchema>;

export const animalRegistrationSchema = z.object({
    animalType: z.string().min(1, 'Animal type is required'),
    breed: z.string().optional(),
    age: z.string().optional(),
    weight: z.string().optional(),
    plantId: z.string().regex(/^\d{4}$/, 'Plant ID must be exactly 4 digits'),
    employeeId: z.string().cuid('Select the employee who received the animal'),
    healthCondition: z.string().optional(),
    rawTranscript: z.string().optional(),
});

export type AnimalRegistrationInput = z.infer<typeof animalRegistrationSchema>;

export const animalListSchema = z.object({
    /** Case-insensitive match against animalType, breed, and plantId */
    search: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(200).default(100),
});

export type AnimalListInput = z.infer<typeof animalListSchema>;

export const animalDeleteSchema = z.object({
    id: z.string().cuid(),
});

export type AnimalDeleteInput = z.infer<typeof animalDeleteSchema>;

export const extractedAnimalFieldsSchema = z.object({
    animalType: z.string().nullable(),
    breed: z.string().nullable(),
    age: z.string().nullable(),
    weight: z.string().nullable(),
    plantId: z.string().nullable(),
    /** Spoken employee name as heard by the transcriber — fuzzy-matched server-side to an employeeId */
    employeeReceived: z.string().nullable(),
    healthCondition: z.string().nullable(),
});

export type ExtractedAnimalFields = z.infer<typeof extractedAnimalFieldsSchema>;
