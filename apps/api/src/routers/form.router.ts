import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc/trpc.js';
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
    listByStage: publicProcedure.input(formListByStageSchema).query(async ({ input, ctx }) => {
        return formService.listByStage(ctx.prisma, input.stage);
    }),

    getById: publicProcedure.input(formGetByIdSchema).query(async ({ input, ctx }) => {
        const form = await formService.getById(ctx.prisma, input.id);
        if (!form) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
        }
        return form;
    }),

    adminList: protectedProcedure.query(async ({ ctx }) => {
        return ctx.prisma.formTemplate.findMany({
            orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
        });
    }),

    digitizeFromPhoto: publicProcedure
        .input(formDigitizeFromPhotoSchema)
        .mutation(async ({ input }) => {
            return formService.digitizeFromPhoto(input.imageBase64, input.mimeType);
        }),

    refineFromRegion: publicProcedure
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

    create: publicProcedure.input(formCreateSchema).mutation(async ({ input, ctx }) => {
        return formService.create(ctx.prisma, input);
    }),

    transcribeField: publicProcedure
        .input(formTranscribeFieldSchema)
        .mutation(async ({ input }) => {
            return formService.transcribeField(input);
        }),
});
