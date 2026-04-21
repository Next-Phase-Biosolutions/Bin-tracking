import { router, publicProcedure } from '../trpc/trpc.js';
import { transcribeAudioSchema, animalRegistrationSchema } from '@bin-tracker/validators';
import { farmerService } from '../services/farmer.service.js';

export const farmerRouter = router({
    /** Transcribe audio and extract animal fields */
    transcribe: publicProcedure
        .input(transcribeAudioSchema)
        .mutation(async ({ input }) => {
            return farmerService.transcribeAndExtract(input);
        }),

    /** Save the reviewed animal registration */
    register: publicProcedure
        .input(animalRegistrationSchema)
        .mutation(async ({ input }) => {
            return farmerService.register(input);
        }),
});
