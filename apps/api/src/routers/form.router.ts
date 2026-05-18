import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc/trpc.js';
import { formListByStageSchema, formGetByIdSchema } from '@bin-tracker/validators';
import { formService } from '../services/form.service.js';

export const formRouter = router({
    /** List all active forms for a given stage — used by the tablet form list */
    listByStage: publicProcedure.input(formListByStageSchema).query(async ({ input, ctx }) => {
        return formService.listByStage(ctx.prisma, input.stage);
    }),

    /** Get a single form template by ID — used when a worker opens a form */
    getById: publicProcedure.input(formGetByIdSchema).query(async ({ input, ctx }) => {
        const form = await formService.getById(ctx.prisma, input.id);
        if (!form) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' });
        }
        return form;
    }),

    /** List all forms (active and inactive) — for ops manager / admin overview */
    adminList: protectedProcedure.query(async ({ ctx }) => {
        return ctx.prisma.formTemplate.findMany({
            orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
        });
    }),
});
