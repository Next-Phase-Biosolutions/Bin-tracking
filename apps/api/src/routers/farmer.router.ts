import { router, stationOrgProcedure, stationProcedure, requireModule } from '../trpc/trpc.js';
import { transcribeAudioSchema, animalRegistrationSchema } from '@bin-tracker/validators';
import { farmerService } from '../services/farmer.service.js';

export const farmerRouter = router({
    /** Transcribe audio and extract animal fields (no DB access — org resolution not required) */
    transcribe: stationProcedure
        .use(requireModule('ANIMAL_INTAKE'))
        .input(transcribeAudioSchema)
        .mutation(async ({ input }) => {
            return farmerService.transcribeAndExtract(input);
        }),

    /** Save the reviewed animal registration */
    register: stationOrgProcedure
        .use(requireModule('ANIMAL_INTAKE'))
        .input(animalRegistrationSchema)
        .mutation(async ({ input, ctx }) => {
            return farmerService.register(input, ctx.orgId);
        }),
});
