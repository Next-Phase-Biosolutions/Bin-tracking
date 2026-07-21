# Whole-Form Voice Fill — Design

**Date:** 2026-07-21
**Branch:** `feat/voice-whole-form-fill`
**Status:** Approved (design)

## Problem

Today's form voice fill (`form.transcribeField`) is **one field at a time**: the worker
taps a Voice button next to a single field, speaks one value, waits, repeats. Three weaknesses:

1. **No whole-form fill.** You can't speak once and have every value routed to the right field.
2. **No options context.** The extraction prompt gets the field label + type but **not** its
   `options`, so dropdown/radio values are guessed as free text that may not match an allowed option.
3. **No domain vocabulary in STT.** AssemblyAI is called with no keyterm boosting, so facility
   jargon, species names, and initials are mis-heard before Claude ever sees them.

## Goal

Let a worker tap **one** button, speak naturally once (describing header fields **and** a table
row), and have the form fill itself — each value routed to the right field, choices snapped to
real options, and low-confidence values flagged for review before submit.

## Scope (v1)

- **Form types:** `standard` and `repeating` only (the fields + table shapes that cover the
  "mix of flat fields + table rows" case). `checklist` / `matrix` keep the existing per-field
  button and are deferred.
- The existing per-field Voice button **stays** everywhere as a fallback.
- **Out of scope:** submission persistence (renderers' `onSubmit` still just flips to the success
  screen — a separate concern, untouched here).

## Architecture

Chosen approach: **one server endpoint does transcribe + extract** (fewest round trips; server
owns the trusted schema and metering).

```
Worker taps "Fill form by voice"
  → useVoiceRecorder captures audio (base64)
  → trpc form.fillByVoice({ formId, audioBase64, mimeType })
      → requireModule('FORMS') + aiRateLimit + checkAndIncrement('voice_transcribe')
      → load FormTemplate by formId (trusted schema; 404 if missing/other-org;
         BAD_REQUEST if formType not standard|repeating)
      → AssemblyAI transcribe  (keyterms_prompt = field labels + options + domain vocab)
      → build field catalog from schema (flat fields + table columns, each id/label/type/options)
      → Claude (system = rules + catalog, user = transcript as data)
      → parse → normalize (date/number/yes_no) → attach per-field confidence
      → return { transcript, fields, tableRows }
  → renderer merges result into its state; low-confidence values get an amber "check this" ring
  → worker fixes flagged fields, taps Submit
```

### Response shape (new type in `@bin-tracker/types`)

```ts
export interface VoiceFilledValue {
    value: string;
    confidence: 'high' | 'low';
}

export interface FormVoiceFillResult {
    transcript: string;
    /** Flat field fills: fieldId -> value (standard sections' fields). */
    fields: Record<string, VoiceFilledValue>;
    /**
     * One appended table row per table.
     * Key = section id (standard table sections) or VOICE_FILL_REPEATING_KEY
     * (the single repeating-form table). Inner map = columnId -> value.
     */
    tableRows: Record<string, Record<string, VoiceFilledValue>>;
}

export const VOICE_FILL_REPEATING_KEY = '__repeating__';
```

## Components

### Backend

- **`packages/validators/src/form.schema.ts`** — add `formFillByVoiceSchema`
  (`{ formId: cuid, audioBase64: string.min(1).max(AUDIO_MAX), mimeType: string.default('audio/webm') }`)
  and `FormFillByVoiceInput`; export via the index barrel. Also add optional `fieldOptions?: string[]`
  to `formTranscribeFieldSchema` (accuracy retrofit for the per-field path).
- **`packages/types/src/form.ts`** — add `VoiceFilledValue`, `FormVoiceFillResult`,
  `VOICE_FILL_REPEATING_KEY`.
- **`apps/api/src/services/form-voice-fill.service.ts`** (new — keeps form.service.ts focused):
  pure helpers `flattenCatalog(schema)`, `buildKeyterms(schema)`, `normalizeVoiceValue(type, raw)`,
  `mapClaudeResponseToResult(schema, parsed, transcript)`; orchestrator `fillFromVoice(schema,
  audioBase64, mimeType, orgId)`. AssemblyAI uses `keyterms_prompt`. Claude uses system/user split
  (transcript is **data**, never instructions).
- **`apps/api/src/routers/form.router.ts`** — add `fillByVoice` procedure
  (`orgProcedure` + `requireModule('FORMS')` + `aiRateLimit()`); loads the template, guards form type,
  delegates to the service.
- **`apps/api/src/services/form.service.ts`** — retrofit `transcribeField` to include `fieldOptions`
  in the Claude prompt so per-field select/radio also snap to allowed options.

### Frontend

- **`apps/web/src/features/forms/VoiceFormFillButton.tsx`** (new) — top-of-form button; wraps
  `useVoiceRecorder` + `trpc.form.fillByVoice`; record → processing → error states; calls
  `onFill(result)` on success. Mirrors `VoiceFieldButton` UX.
- **`apps/web/src/features/forms/FieldComponents.tsx`** — add optional `flagged?: boolean` to inputs
  → amber ring + "check this" hint; threaded through `FieldInput`.
- **`apps/web/src/features/forms/SectionRepeatingTable.tsx`** — accept `flaggedKeys?: Set<string>`
  → amber cell ring for flagged cells of the appended row.
- **`StandardFormRenderer.tsx`** — accept `formId`; render `VoiceFormFillButton`; on fill merge
  `fields` into `values`, append each `tableRows[sectionId]` row, record flagged keys.
- **`RepeatingRowFormRenderer.tsx`** — accept `formId`; render `VoiceFormFillButton`; on fill append
  `tableRows[VOICE_FILL_REPEATING_KEY]` as a new row with flagged cells.
- **`FormRenderer.tsx`** — pass `form.id` to the two renderers.

## Accuracy upgrades (shared)

1. **Options context** → Claude snaps dropdown/radio/select to exact allowed values (both endpoints).
2. **Keyterm boosting** → `keyterms_prompt` from the form's own labels + options + a small facility
   domain-vocab constant.
3. **Type normalization** → "today"→ISO date, "twelve"→`12`, yes/no→`Yes`/`No`.
4. **Per-field confidence** → low-confidence values flagged amber for review.

## Metering

One `voice_transcribe` slot per whole-form fill (vs one per field today) — better UX **and** lighter
on quota. Same `checkAndIncrement` atomic pattern as `transcribeField`.

## Error handling

- Mic denied / no speech / AssemblyAI error → surfaced inline on the button, form untouched.
- Claude parse failure → `INTERNAL_SERVER_ERROR` with a retry affordance; form untouched.
- Unsupported form type → `BAD_REQUEST` (button not shown for checklist/matrix anyway).
- Quota exceeded → `TOO_MANY_REQUESTS` from `checkAndIncrement`, surfaced inline.

## Testing

- **Unit (pure):** `flattenCatalog`, `buildKeyterms`, `normalizeVoiceValue`,
  `mapClaudeResponseToResult` — including options-snapping and table-row routing for both
  standard and repeating schemas.
- **Service:** `fillFromVoice` with AssemblyAI + Claude mocked (mirror `form.service.test.ts`),
  asserting metering, keyterm assembly, and result shape.
- **Router:** form-type guard (standard/repeating pass; checklist/matrix → BAD_REQUEST), cross-org 404.
