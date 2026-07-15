import { TRPCError } from '@trpc/server';
import { router, orgProcedure, stationOrgProcedure, stationProcedure, orgOpsProcedure, requireModule } from '../trpc/trpc.js';
import { aiRateLimit } from '../trpc/rate-limit.js';
import {
    formListByStageSchema,
    formGetByIdSchema,
    formDigitizeFromPhotoSchema,
    formDigitizeJobStatusSchema,
    formRefineFromRegionSchema,
    formCreateSchema,
    formTranscribeFieldSchema,
} from '@bin-tracker/validators';
import { formService } from '../services/form.service.js';
import { getHeavyJobsQueue, FORM_DIGITIZE_JOB } from '../lib/queue.js';
import type { FormDigitizeDraft } from '@bin-tracker/types';

export const formRouter = router({
    listByStage: stationOrgProcedure
        .use(requireModule('FORMS'))
        .input(formListByStageSchema)
        .query(async ({ input, ctx }) => {
            return formService.listByStage(ctx.prisma, ctx.orgId, input.stage);
        }),

    getById: stationOrgProcedure
        .use(requireModule('FORMS'))
        .input(formGetByIdSchema)
        .query(async ({ input, ctx }) => {
            const form = await formService.getById(ctx.prisma, ctx.orgId, input.id);
            if (!form) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
            }
            return form;
        }),

    adminList: orgProcedure
        .query(async ({ ctx }) => {
            return ctx.prisma.formTemplate.findMany({
                where: { organizationId: ctx.orgId },
                orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
            });
        }),

    /**
     * Enqueues a digitize job on the shared `heavy-jobs` queue and returns
     * immediately with a jobId — Gemini's vision call takes 10-30s, long
     * enough to risk a request timeout. Poll `digitizeJobStatus` for the
     * result. Mirrors payroll.router.ts's computeRun/jobStatus pattern
     * (Task 22a) on the same queue.
     */
    digitizeFromPhoto: orgOpsProcedure
        .use(requireModule('FORMS_AI_DIGITIZE'))
        .use(aiRateLimit())
        .input(formDigitizeFromPhotoSchema)
        .mutation(async ({ input, ctx }) => {
            const job = await getHeavyJobsQueue().add(FORM_DIGITIZE_JOB, {
                orgId: ctx.orgId,
                imageBase64: input.imageBase64,
                mimeType: input.mimeType,
            });
            return { jobId: job.id! };
        }),

    /**
     * Polls the status of a `digitizeFromPhoto` job. Same cross-org denial
     * discipline as payroll.router.ts's jobStatus: a job that doesn't exist
     * and a job belonging to another org both report NOT_FOUND.
     */
    digitizeJobStatus: orgOpsProcedure
        .use(requireModule('FORMS_AI_DIGITIZE'))
        .input(formDigitizeJobStatusSchema)
        .query(async ({ ctx, input }) => {
            const job = await getHeavyJobsQueue().getJob(input.jobId);
            if (!job || job.data.orgId !== ctx.orgId) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
            }

            const state = await job.getState();
            if (state === 'completed') {
                // FormDigitizeDraft has no Date fields, so unlike PayrollRunView
                // it needs no revival after BullMQ's JSON round-trip (verified
                // in form.router.test.ts). The queue's returnvalue type is the
                // union across all heavy-jobs job types; this job name only
                // ever produces a FormDigitizeDraft.
                return { state, result: job.returnvalue as FormDigitizeDraft };
            }
            if (state === 'failed') {
                return { state, error: job.failedReason };
            }
            return { state };
        }),

    refineFromRegion: orgOpsProcedure
        .use(requireModule('FORMS_AI_DIGITIZE'))
        .use(aiRateLimit())
        .input(formRefineFromRegionSchema)
        .mutation(async ({ input, ctx }) => {
            const draft = {
                ...input.currentDraft,
                description: input.currentDraft.description ?? null,
            };
            return formService.refineFromRegion(
                input.imageBase64,
                draft,
                ctx.orgId,
                input.mimeType,
                input.userNote,
            );
        }),

    create: orgOpsProcedure
        .use(requireModule('FORMS'))
        .input(formCreateSchema)
        .mutation(async ({ input, ctx }) => {
            return formService.create(ctx.prisma, input, ctx.orgId);
        }),

    transcribeField: stationProcedure
        .use(requireModule('FORMS'))
        .input(formTranscribeFieldSchema)
        .mutation(async ({ input, ctx }) => {
            return formService.transcribeField(input, ctx.orgId);
        }),
});
