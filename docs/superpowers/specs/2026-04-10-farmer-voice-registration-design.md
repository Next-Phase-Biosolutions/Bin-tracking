# Farmer Voice Registration — Design Spec

**Date:** 2026-04-10
**Project:** bin-tracker
**Status:** Approved for implementation

---

## Context

Farmers supplying animals to the facility cannot write or fill forms themselves. This feature allows them to verbally answer questions about their animal in English (any accent), while the system transcribes and auto-fills a structured registration form on their behalf. The feature lives as a standalone tab in the existing bin-tracker web app.

---

## Architecture

### High-Level Flow

```
Farmer speaks → Browser records audio (MediaRecorder)
             → Audio sent to backend (tRPC multipart)
             → AssemblyAI transcribes audio → text
             → Claude reads transcript → extracts structured JSON
             → Frontend fills form fields
             → User reviews → Submits → Saved to DB
```

### Two Recording Modes (user's choice)

1. **Per-question mode** — Record button next to each field. Farmer speaks one answer at a time. AI fills just that field.
2. **Full recording mode** — Single "Record All" button. Farmer speaks all answers continuously. AI fills all fields at once.

---

## Components

### Frontend — New Feature: `farmer-registration`

**Location:** `apps/web/src/features/farmer-registration/`

Files:
- `FarmerRegistrationPage.tsx` — Main page, split layout
- `AnimalForm.tsx` — Left panel: 6 form fields (read-only until AI fills them, editable after)
- `VoiceRecorder.tsx` — Right panel: record button(s), waveform indicator, status text
- `useVoiceRecorder.ts` — Hook: manages MediaRecorder, audio blob, browser format detection
- `useFarmerRegistration.ts` — Hook: orchestrates tRPC call, fills form state

**Layout (split screen):**
```
┌─────────────────────┬──────────────────────┐
│   ANIMAL DETAILS    │   VOICE RECORDER     │
│                     │                      │
│ Animal Type: [    ] │  [● Record All]      │
│ Breed:       [    ] │                      │
│ Age:         [    ] │  — or per question— │
│ Weight:      [    ] │                      │
│ Owner Name:  [    ] │  Animal Type [●]     │
│ Health:      [    ] │  Breed       [●]     │
│                     │  Age         [●]     │
│    [Submit]         │  Weight      [●]     │
│                     │  Owner Name  [●]     │
│                     │  Health      [●]     │
└─────────────────────┴──────────────────────┘
```

**Form Fields:**
| Field | Type | Example |
|---|---|---|
| Animal Type | text | "Cow", "Goat", "Sheep" |
| Breed | text | "Holstein", "Boer" |
| Age | text | "3 years" |
| Weight | text | "250 kg" |
| Owner Name | text | "Abdul Rehman" |
| Health Condition | text | "Healthy, no issues" |

**Browser audio format detection (iOS/Android compatibility):**
```ts
const mimeType = MediaRecorder.isTypeSupported('audio/webm')
  ? 'audio/webm'
  : 'audio/mp4'; // iOS Safari fallback
```

---

### Backend — New tRPC Router

**Location:** `apps/api/src/routers/farmer.router.ts`

**Endpoint:** `farmer.transcribeAndExtract`

- Accepts: audio file (base64 or binary) + optional `targetField` (for per-question mode)
- Calls AssemblyAI to transcribe audio → gets text
- Calls Claude API to extract structured JSON from transcript
- Returns: `{ animalType, breed, age, weight, ownerName, healthCondition }`

**Claude extraction prompt:**
```
Given this transcript from a farmer describing their animal, extract the following fields as JSON:
- animalType, breed, age, weight, ownerName, healthCondition

If a field is not mentioned, return null for it.
Transcript: "<transcript here>"
```

**Environment variables to add to `.env`:**
```env
ASSEMBLYAI_API_KEY=15975b2af2724b45a9b02cf7f770667d
ANTHROPIC_API_KEY=<your claude key>
```

---

### Database — New Prisma Model

**Location:** `packages/db/prisma/schema.prisma`

```prisma
model AnimalRegistration {
  id              String   @id @default(cuid())
  animalType      String
  breed           String?
  age             String?
  weight          String?
  ownerName       String
  healthCondition String?
  createdAt       DateTime @default(now())
}
```

Simple standalone table — no foreign keys to bins for now.

---

### Navigation — New Tab

**Location:** `apps/web/src/App.tsx` (or router config)

Add route: `/app/farmer` → `FarmerRegistrationPage`

Add tab to the existing app navigation alongside Tablet, Driver, Dashboard.

---

## Data Flow Detail

### Per-Question Mode
1. Farmer clicks record [●] next to "Animal Type"
2. `useVoiceRecorder` starts `MediaRecorder`, captures blob
3. On stop → blob sent via `farmer.transcribeAndExtract({ audio, targetField: 'animalType' })`
4. Claude returns `{ animalType: "Cow" }` → only that field fills
5. Farmer moves to next question

### Full Recording Mode
1. Farmer clicks [● Record All]
2. Records full answer: *"My name is Abdul, I have a Holstein cow, about 4 years old, weighs 280 kg, she is healthy"*
3. On stop → blob sent via `farmer.transcribeAndExtract({ audio })`
4. Claude returns all 6 fields at once → all fields fill
5. Farmer reviews, edits if needed → submits

---

## Dependencies to Install

**API (`apps/api`):**
```bash
npm install assemblyai @anthropic-ai/sdk
```

**Web (`apps/web`):**
No new dependencies — uses native `MediaRecorder` API.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Microphone permission denied | Show "Please allow microphone access" message |
| AssemblyAI fails | Show "Transcription failed, please try again" |
| Claude extraction returns null fields | Leave those fields empty, farmer fills manually |
| No speech detected | Show "No speech detected, please try again" |

---

## Verification / Testing

1. Open `/app/farmer` tab in browser
2. Click "Record All" → speak: *"My name is John, I have a 3 year old goat, weighs 45 kg, breed is Boer, healthy"*
3. Verify all 6 fields auto-fill correctly
4. Edit a field manually → click Submit
5. Check DB: `AnimalRegistration` table has a new row
6. Test on mobile (Chrome Android + Safari iOS) — both should work
7. Test with different accents (Indian, British, etc.)
