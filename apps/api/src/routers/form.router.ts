import { TRPCError } from '@trpc/server';
import { router, orgProcedure, stationOrgProcedure, stationProcedure, orgOpsProcedure, requireModule } from '../trpc/trpc.js';
import {
    formListByStageSchema,
    formGetByIdSchema,
    formDigitizeFromPhotoSchema,
    formRefineFromRegionSchema,
    formCreateSchema,
    formTranscribeFieldSchema,
} from '@bin-tracker/validators';
import { formService } from '../services/form.service.js';

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

    // Not in the brief's explicit FORMS list, but it's the form-template admin
    // screen for the same feature area — leaving it ungated would let an org
    // without FORMS still manage form templates.
    adminList: orgProcedure
        .use(requireModule('FORMS'))
        .query(async ({ ctx }) => {
            return ctx.prisma.formTemplate.findMany({
                where: { organizationId: ctx.orgId },
                orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
            });
        }),

    digitizeFromPhoto: orgOpsProcedure
        .use(requireModule('FORMS_AI_DIGITIZE'))
        .input(formDigitizeFromPhotoSchema)
        .mutation(async ({ input }) => {
            return formService.digitizeFromPhoto(input.imageBase64, input.mimeType);
        }),

    refineFromRegion: orgOpsProcedure
        .use(requireModule('FORMS_AI_DIGITIZE'))
        .input(formRefineFromRegionSchema)
        .mutation(async ({ input }) => {
            const draft = {
                ...input.currentDraft,
                description: input.currentDraft.description ?? null,
            };
            return formService.refineFromRegion(
                input.imageBase64,
                draft,
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
        .mutation(async ({ input }) => {
            return formService.transcribeField(input);
        }),
});
