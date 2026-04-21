# Farmer Voice Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/app/farmer` tab to bin-tracker where farmers answer questions about their animal by voice, AssemblyAI transcribes the audio, Claude extracts structured fields, and the form auto-fills for review and submission.

**Architecture:** Browser records audio via `MediaRecorder` → sends base64 to a new tRPC `farmer.transcribe` mutation → AssemblyAI transcribes to text → Claude extracts 6 fields as JSON → frontend fills form → farmer reviews and submits → saved to `animal_registrations` DB table.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, tRPC v11, Fastify, Prisma, AssemblyAI Node SDK, Anthropic SDK, Zod

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `packages/validators/src/farmer.schema.ts` | Zod schemas for transcribe input + animal registration |
| `apps/api/src/services/farmer.service.ts` | AssemblyAI transcription + Claude extraction logic |
| `apps/api/src/routers/farmer.router.ts` | tRPC router exposing `transcribe` and `register` mutations |
| `apps/web/src/features/farmer-registration/FarmerRegistrationPage.tsx` | Main page — split layout, composes form + recorder |
| `apps/web/src/features/farmer-registration/AnimalForm.tsx` | Left panel — 6 editable form fields + submit button |
| `apps/web/src/features/farmer-registration/VoiceRecorder.tsx` | Right panel — Record All button + per-field record buttons |
| `apps/web/src/features/farmer-registration/useVoiceRecorder.ts` | Hook — MediaRecorder lifecycle, blob capture, format detection |

### Modified Files
| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | Add `AnimalRegistration` model |
| `packages/validators/src/index.ts` | Export farmer schemas |
| `apps/api/src/routers/index.ts` | Register `farmerRouter` |
| `apps/web/src/App.tsx` | Add `/app/farmer` route |
| `.env` | Add `ASSEMBLYAI_API_KEY` and `ANTHROPIC_API_KEY` |

---

## Task 1: Add environment variables

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add API keys to `.env`**

Open `.env` and add after the existing `# ─── API Server` section:

```env
# ─── AI / Voice ────────────────────────────────────────
ASSEMBLYAI_API_KEY=15975b2af2724b45a9b02cf7f770667d
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

> **Note:** Replace `your_anthropic_api_key_here` with a real key from `console.anthropic.com`. The AssemblyAI key is already set.

- [ ] **Step 2: Commit**

```bash
cd /Users/cryptonean/Desktop/abdul/bin-tracker
git add .env
git commit -m "chore: add AssemblyAI and Anthropic API keys to env"
```

---

## Task 2: Add Prisma model for animal registrations

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add the model at the bottom of schema.prisma**

Append this after the last model (`EventLog`):

```prisma
model AnimalRegistration {
  id              String   @id @default(cuid())
  animalType      String
  breed           String?
  age             String?
  weight          String?
  ownerName       String
  healthCondition String?
  rawTranscript   String?
  createdAt       DateTime @default(now())

  @@map("animal_registrations")
}
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/cryptonean/Desktop/abdul/bin-tracker
npx prisma migrate dev --name add_animal_registration --schema packages/db/prisma/schema.prisma
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat: add AnimalRegistration model to schema"
```

---

## Task 3: Add Zod validation schemas

**Files:**
- Create: `packages/validators/src/farmer.schema.ts`
- Modify: `packages/validators/src/index.ts`

- [ ] **Step 1: Create `farmer.schema.ts`**

```typescript
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
```

- [ ] **Step 2: Export from `packages/validators/src/index.ts`**

Add at the bottom of the file:

```typescript
export {
    transcribeAudioSchema,
    animalRegistrationSchema,
    extractedAnimalFieldsSchema,
    type TranscribeAudioInput,
    type AnimalRegistrationInput,
    type ExtractedAnimalFields,
} from './farmer.schema.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/validators/src/farmer.schema.ts packages/validators/src/index.ts
git commit -m "feat: add farmer validation schemas"
```

---

## Task 4: Install dependencies

**Files:** `apps/api/package.json`

- [ ] **Step 1: Install AssemblyAI and Anthropic SDKs in the API**

```bash
cd /Users/cryptonean/Desktop/abdul/bin-tracker/apps/api
npm install assemblyai @anthropic-ai/sdk
```

Expected: both packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
cd /Users/cryptonean/Desktop/abdul/bin-tracker
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore: install assemblyai and anthropic sdk in api"
```

---

## Task 5: Create farmer service (transcription + extraction)

**Files:**
- Create: `apps/api/src/services/farmer.service.ts`

- [ ] **Step 1: Create `farmer.service.ts`**

```typescript
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
                language_code: 'en',
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
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'AssemblyAI transcription error',
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/farmer.service.ts
git commit -m "feat: add farmer service with AssemblyAI + Claude extraction"
```

---

## Task 6: Create farmer tRPC router

**Files:**
- Create: `apps/api/src/routers/farmer.router.ts`
- Modify: `apps/api/src/routers/index.ts`

- [ ] **Step 1: Create `farmer.router.ts`**

```typescript
import { router, publicProcedure } from '../trpc/trpc.js';
import { transcribeAudioSchema, animalRegistrationSchema } from '@bin-tracker/validators';
import { farmerService } from '../services/farmer.service.js';

export const farmerRouter = router({
    /** Transcribe audio and extract animal fields */
    transcribe: publicProcedure
        .input(transcribeAudioSchema)
        .mutation(async ({ input }) => {
            return farmerService.transcribeAndExtract(input);
        }),

    /** Save the reviewed animal registration */
    register: publicProcedure
        .input(animalRegistrationSchema)
        .mutation(async ({ input }) => {
            return farmerService.register(input);
        }),
});
```

- [ ] **Step 2: Register in `apps/api/src/routers/index.ts`**

Replace the entire file with:

```typescript
import { router } from '../trpc/trpc.js';
import { binRouter } from './bin.router.js';
import { cycleRouter } from './cycle.router.js';
import { facilityRouter } from './facility.router.js';
import { dashboardRouter } from './dashboard.router.js';
import { blockchainRouter } from './blockchain.router.js';
import { farmerRouter } from './farmer.router.js';

export const appRouter = router({
    bin: binRouter,
    cycle: cycleRouter,
    facility: facilityRouter,
    dashboard: dashboardRouter,
    blockchain: blockchainRouter,
    farmer: farmerRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routers/farmer.router.ts apps/api/src/routers/index.ts
git commit -m "feat: add farmer tRPC router with transcribe and register mutations"
```

---

## Task 7: Create `useVoiceRecorder` hook

**Files:**
- Create: `apps/web/src/features/farmer-registration/useVoiceRecorder.ts`

- [ ] **Step 1: Create `useVoiceRecorder.ts`**

```typescript
import { useState, useRef, useCallback } from 'react';

type RecordingStatus = 'idle' | 'recording' | 'processing';

interface UseVoiceRecorderResult {
    status: RecordingStatus;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    audioBase64: string | null;
    mimeType: 'audio/webm' | 'audio/mp4';
    error: string | null;
    clearAudio: () => void;
}

function getSupportedMimeType(): 'audio/webm' | 'audio/mp4' {
    return MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mimeType = getSupportedMimeType();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        setError(null);
        setAudioBase64(null);
        chunksRef.current = [];

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setError('Microphone access denied. Please allow microphone permission and try again.');
            return;
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1] ?? '';
                setAudioBase64(base64);
                setStatus('idle');
            };
            reader.readAsDataURL(blob);

            // Stop all microphone tracks to release the mic
            stream.getTracks().forEach((track) => track.stop());
        };

        recorder.start();
        setStatus('recording');
    }, [mimeType]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            setStatus('processing');
            mediaRecorderRef.current.stop();
        }
    }, []);

    const clearAudio = useCallback(() => {
        setAudioBase64(null);
        setError(null);
        setStatus('idle');
    }, []);

    return { status, startRecording, stopRecording, audioBase64, mimeType, error, clearAudio };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/farmer-registration/useVoiceRecorder.ts
git commit -m "feat: add useVoiceRecorder hook with iOS Safari fallback"
```

---

## Task 8: Create `VoiceRecorder` component

**Files:**
- Create: `apps/web/src/features/farmer-registration/VoiceRecorder.tsx`

- [ ] **Step 1: Create `VoiceRecorder.tsx`**

This component manages recording state internally — including tracking `activeField` for per-question mode — and fires `onAudioReady` via a `useEffect` that watches the `audioBase64` value from the hook.

```tsx
import { useEffect, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from './useVoiceRecorder';

type FieldKey = 'animalType' | 'breed' | 'age' | 'weight' | 'ownerName' | 'healthCondition';

interface VoiceRecorderProps {
    onAudioReady: (audioBase64: string, mimeType: 'audio/webm' | 'audio/mp4', targetField?: FieldKey) => void;
    isProcessing: boolean;
}

const FIELD_LABELS: Record<FieldKey, string> = {
    animalType: 'Animal Type',
    breed: 'Breed',
    age: 'Age',
    weight: 'Weight',
    ownerName: 'Owner Name',
    healthCondition: 'Health Condition',
};

const FIELDS = Object.keys(FIELD_LABELS) as FieldKey[];

export function VoiceRecorder({ onAudioReady, isProcessing }: VoiceRecorderProps) {
    const { status, startRecording, stopRecording, audioBase64, mimeType, error, clearAudio } =
        useVoiceRecorder();

    // Tracks which field the current recording targets (undefined = record all)
    const [activeField, setActiveField] = useState<FieldKey | undefined>(undefined);

    // When audioBase64 becomes available after recording stops, fire the callback
    useEffect(() => {
        if (!audioBase64) return;
        onAudioReady(audioBase64, mimeType, activeField);
        clearAudio();
        setActiveField(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioBase64]);

    const handleStartAll = async () => {
        setActiveField(undefined);
        await startRecording();
    };

    const handleStartField = async (field: FieldKey) => {
        setActiveField(field);
        await startRecording();
    };

    return (
        <div className="flex flex-col gap-6">
            {/* ── Record All ── */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Record All at Once
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                    Speak all your animal details in one go.
                </p>

                {status === 'idle' && (
                    <button
                        onClick={handleStartAll}
                        disabled={isProcessing}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                        <Mic className="h-4 w-4" />
                        Start Recording
                    </button>
                )}

                {status === 'recording' && !activeField && (
                    <button
                        onClick={stopRecording}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                        <MicOff className="h-4 w-4 animate-pulse" />
                        Stop Recording
                    </button>
                )}

                {(status === 'processing' || isProcessing) && (
                    <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                    </div>
                )}
            </div>

            {/* ── Per-Field ── */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Record Per Question
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                    Record one field at a time.
                </p>

                <div className="flex flex-col gap-2">
                    {FIELDS.map((field) => (
                        <div key={field} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-700">{FIELD_LABELS[field]}</span>

                            {status === 'recording' && activeField === field ? (
                                <button
                                    onClick={stopRecording}
                                    className="flex items-center gap-1 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                                >
                                    <MicOff className="h-3 w-3 animate-pulse" />
                                    Stop
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleStartField(field)}
                                    disabled={status !== 'idle' || isProcessing}
                                    className="flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-40"
                                >
                                    <Mic className="h-3 w-3" />
                                    Record
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/farmer-registration/VoiceRecorder.tsx
git commit -m "feat: add VoiceRecorder component with record-all and per-field modes"
```

---

## Task 9: Create `AnimalForm` component

**Files:**
- Create: `apps/web/src/features/farmer-registration/AnimalForm.tsx`

- [ ] **Step 1: Create `AnimalForm.tsx`**

```tsx
import type { ExtractedAnimalFields } from '@bin-tracker/validators';

interface AnimalFormProps {
    fields: Partial<ExtractedAnimalFields>;
    onChange: (field: keyof ExtractedAnimalFields, value: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    submitSuccess: boolean;
}

const FIELD_CONFIG: Array<{
    key: keyof ExtractedAnimalFields;
    label: string;
    placeholder: string;
}> = [
    { key: 'animalType', label: 'Animal Type', placeholder: 'e.g. Cow, Goat, Sheep' },
    { key: 'breed', label: 'Breed', placeholder: 'e.g. Holstein, Boer' },
    { key: 'age', label: 'Age', placeholder: 'e.g. 3 years' },
    { key: 'weight', label: 'Weight', placeholder: 'e.g. 250 kg' },
    { key: 'ownerName', label: 'Owner Name', placeholder: 'e.g. Abdul Rehman' },
    { key: 'healthCondition', label: 'Health Condition', placeholder: 'e.g. Healthy, no issues' },
];

export function AnimalForm({ fields, onChange, onSubmit, isSubmitting, submitSuccess }: AnimalFormProps) {
    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-lg font-semibold text-gray-900">Animal Details</h2>

                <div className="flex flex-col gap-4">
                    {FIELD_CONFIG.map(({ key, label, placeholder }) => (
                        <div key={key}>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                {label}
                                {(key === 'animalType' || key === 'ownerName') && (
                                    <span className="ml-1 text-red-500">*</span>
                                )}
                            </label>
                            <input
                                type="text"
                                value={fields[key] ?? ''}
                                onChange={(e) => onChange(key, e.target.value)}
                                placeholder={placeholder}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    ))}
                </div>

                <button
                    onClick={onSubmit}
                    disabled={isSubmitting || !fields.animalType || !fields.ownerName}
                    className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {isSubmitting ? 'Saving...' : 'Submit Registration'}
                </button>

                {submitSuccess && (
                    <p className="mt-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                        Animal registration saved successfully.
                    </p>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/farmer-registration/AnimalForm.tsx
git commit -m "feat: add AnimalForm component with editable fields and submit"
```

---

## Task 10: Create `FarmerRegistrationPage`

**Files:**
- Create: `apps/web/src/features/farmer-registration/FarmerRegistrationPage.tsx`

- [ ] **Step 1: Create `FarmerRegistrationPage.tsx`**

`handleAudioReady` is stable via `useCallback` and calls the mutation directly — no ref/effect needed.

```tsx
import { useState, useCallback } from 'react';
import { trpc } from '../../lib/trpc';
import { AnimalForm } from './AnimalForm';
import { VoiceRecorder } from './VoiceRecorder';
import type { ExtractedAnimalFields } from '@bin-tracker/validators';

type FieldKey = keyof ExtractedAnimalFields;

const EMPTY_FIELDS: ExtractedAnimalFields = {
    animalType: null,
    breed: null,
    age: null,
    weight: null,
    ownerName: null,
    healthCondition: null,
};

export default function FarmerRegistrationPage() {
    const [formFields, setFormFields] = useState<ExtractedAnimalFields>({ ...EMPTY_FIELDS });
    const [transcriptLog, setTranscriptLog] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcribeError, setTranscribeError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const transcribeMutation = trpc.farmer.transcribe.useMutation();
    const registerMutation = trpc.farmer.register.useMutation();

    // Called by VoiceRecorder once audio blob is base64-encoded and ready
    const handleAudioReady = useCallback(
        (audioBase64: string, mimeType: 'audio/webm' | 'audio/mp4', targetField?: FieldKey) => {
            setIsProcessing(true);
            setTranscribeError(null);

            transcribeMutation.mutate(
                { audioBase64, mimeType, targetField },
                {
                    onSuccess: (data) => {
                        setTranscriptLog((prev) => [...prev, data.transcript]);
                        setFormFields((prev) => {
                            const next = { ...prev };
                            for (const [key, val] of Object.entries(data.fields)) {
                                if (val !== null) {
                                    next[key as FieldKey] = val;
                                }
                            }
                            return next;
                        });
                        setIsProcessing(false);
                    },
                    onError: (err) => {
                        setTranscribeError(err.message);
                        setIsProcessing(false);
                    },
                },
            );
        },
        [transcribeMutation],
    );

    const handleFieldChange = (field: FieldKey, value: string) => {
        setFormFields((prev) => ({ ...prev, [field]: value || null }));
    };

    const handleSubmit = () => {
        if (!formFields.animalType || !formFields.ownerName) return;

        setIsSubmitting(true);
        setSubmitSuccess(false);

        registerMutation.mutate(
            {
                animalType: formFields.animalType,
                breed: formFields.breed ?? undefined,
                age: formFields.age ?? undefined,
                weight: formFields.weight ?? undefined,
                ownerName: formFields.ownerName,
                healthCondition: formFields.healthCondition ?? undefined,
                rawTranscript: transcriptLog.join(' | ') || undefined,
            },
            {
                onSuccess: () => {
                    setSubmitSuccess(true);
                    setFormFields({ ...EMPTY_FIELDS });
                    setTranscriptLog([]);
                    setIsSubmitting(false);
                },
                onError: () => {
                    setIsSubmitting(false);
                },
            },
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-5xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Farmer Animal Registration</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Record your answers by voice — the form will fill automatically.
                    </p>
                </div>

                {transcribeError && (
                    <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                        {transcribeError}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Left — Form */}
                    <AnimalForm
                        fields={formFields}
                        onChange={handleFieldChange}
                        onSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                        submitSuccess={submitSuccess}
                    />

                    {/* Right — Voice Recorder */}
                    <VoiceRecorder
                        onAudioReady={handleAudioReady}
                        isProcessing={isProcessing}
                    />
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/farmer-registration/FarmerRegistrationPage.tsx
git commit -m "feat: add FarmerRegistrationPage with split layout"
```

---

## Task 11: Register route in App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add route to `App.tsx`**

Replace the entire file with:

```tsx
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SolutionsPage } from './pages/SolutionsPage';
import { ProcessPage } from './pages/ProcessPage';
import TabletPage from './features/tablet/TabletPage';
import DriverPage from './features/driver/DriverPage';
import DashboardPage from './features/dashboard/DashboardPage';
import { AboutPage } from './pages/AboutPage';
import FarmerRegistrationPage from './features/farmer-registration/FarmerRegistrationPage';

export function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/process" element={<ProcessPage />} />
            <Route path="/app/bin" element={<TabletPage />} />
            <Route path="/app/driver" element={<DriverPage />} />
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/farmer" element={<FarmerRegistrationPage />} />
        </Routes>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: add /app/farmer route to app router"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Start the dev servers**

```bash
cd /Users/cryptonean/Desktop/abdul/bin-tracker
npm run dev
```

Expected: API runs on `http://localhost:3001`, Web on `http://localhost:3000`

- [ ] **Step 2: Open farmer tab**

Navigate to `http://localhost:3000/app/farmer`

Expected: Split layout — "Animal Details" form on left, "Voice Recorder" on right

- [ ] **Step 3: Test full recording mode**

Click **Start Recording** → speak clearly:
> *"My name is John, I have a Holstein cow, about 4 years old, weighs 300 kg, she is healthy"*

Click **Stop Recording**

Expected:
- "Processing..." spinner appears briefly
- All 6 fields fill automatically
- animalType: "Cow", breed: "Holstein", age: "4 years", weight: "300 kg", ownerName: "John", healthCondition: "healthy"

- [ ] **Step 4: Test per-field mode**

Clear the form (refresh page). Click **Record** next to "Animal Type" → say "Goat" → stop.

Expected: Only the `animalType` field fills with "Goat"

- [ ] **Step 5: Test submit**

Fill in any missing required fields (Animal Type, Owner Name) → click **Submit Registration**

Expected: "Animal registration saved successfully." appears, form clears

- [ ] **Step 6: Verify DB record**

```bash
cd /Users/cryptonean/Desktop/abdul/bin-tracker
npx prisma studio --schema packages/db/prisma/schema.prisma
```

Open browser → check `AnimalRegistration` table has a new row with the correct fields.

- [ ] **Step 7: Test on mobile (if available)**

Open `http://<your-local-ip>:3000/app/farmer` on phone browser

Expected: Recording works on both Chrome Android and Safari iOS
