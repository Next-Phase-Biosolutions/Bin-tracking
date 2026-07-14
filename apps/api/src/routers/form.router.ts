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

    adminList: orgProcedure
        .query(async ({ ctx }) => {
            return ctx.prisma.formTemplate.findMany({
                where: { organizationId: ctx.orgId },
                orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
            });
        }),

    digitizeFromPhoto: orgOpsProcedure
        .use(requireModule('FORMS_AI_DIGITIZE'))
        .input(formDigitizeFromPhotoSchema)
        .mutation(async ({ input, ctx }) => {
            return formService.digitizeFromPhoto(input.imageBase64, ctx.orgId, input.mimeType);
        }),

    refineFromRegion: orgOpsProcedure
        .use(requireModule('FORMS_AI_DIGITIZE'))
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
