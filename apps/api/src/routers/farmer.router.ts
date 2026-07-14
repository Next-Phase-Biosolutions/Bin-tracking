import { router, stationOrgProcedure, stationProcedure } from '../trpc/trpc.js';
import { transcribeAudioSchema, animalRegistrationSchema } from '@bin-tracker/validators';
import { farmerService } from '../services/farmer.service.js';

export const farmerRouter = router({
    /** Transcribe audio and extract animal fields (no DB access — org resolution not required) */
    transcribe: stationProcedure
        .input(transcribeAudioSchema)
        .mutation(async ({ input }) => {
            return farmerService.transcribeAndExtract(input);
        }),

    /** Save the reviewed animal registration */
    register: stationOrgProcedure
        .input(animalRegistrationSchema)
        .mutation(async ({ input, ctx }) => {
            return farmerService.register(input, ctx.orgId);
        }),
});
