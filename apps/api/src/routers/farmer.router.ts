import { router, orgProcedure, orgOpsProcedure, requireModule } from '../trpc/trpc.js';
import {
    transcribeAudioSchema,
    animalRegistrationSchema,
    animalListSchema,
    animalDeleteSchema,
} from '@bin-tracker/validators';
import { farmerService } from '../services/farmer.service.js';

export const farmerRouter = router({
    /** Transcribe audio and extract animal fields */
    transcribe: orgProcedure
        .use(requireModule('ANIMAL_INTAKE'))
        .input(transcribeAudioSchema)
        .mutation(async ({ input, ctx }) => {
            return farmerService.transcribeAndExtract(input, ctx.orgId);
        }),

    /** Save the reviewed animal registration */
    register: orgProcedure
        .use(requireModule('ANIMAL_INTAKE'))
        .input(animalRegistrationSchema)
        .mutation(async ({ input, ctx }) => {
            return farmerService.register(input, ctx.orgId);
        }),

    /** Org-scoped registration list for the records dashboard */
    list: orgProcedure
        .use(requireModule('ANIMAL_INTAKE'))
        .input(animalListSchema)
        .query(async ({ input, ctx }) => {
            return farmerService.list(ctx.orgId, input);
        }),

    /** Totals + per-type counts for the records dashboard stat cards */
    stats: orgProcedure
        .use(requireModule('ANIMAL_INTAKE'))
        .query(async ({ ctx }) => {
            return farmerService.stats(ctx.orgId);
        }),

    /** Delete a mistaken registration (ADMIN / OPS_MANAGER only) */
    remove: orgOpsProcedure
        .use(requireModule('ANIMAL_INTAKE'))
        .input(animalDeleteSchema)
        .mutation(async ({ input, ctx }) => {
            return farmerService.remove(ctx.orgId, input.id);
        }),
});
