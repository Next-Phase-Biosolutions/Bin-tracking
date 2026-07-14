import { router, stationProcedure } from '../trpc/trpc.js';
import { transcribeAudioSchema, animalRegistrationSchema } from '@bin-tracker/validators';
import { farmerService } from '../services/farmer.service.js';
import { getDefaultOrganizationId } from '../lib/default-org.js';

export const farmerRouter = router({
    /** Transcribe audio and extract animal fields */
    transcribe: stationProcedure
        .input(transcribeAudioSchema)
        .mutation(async ({ input }) => {
            return farmerService.transcribeAndExtract(input);
        }),

    /** Save the reviewed animal registration */
    register: stationProcedure
        .input(animalRegistrationSchema)
        .mutation(async ({ input }) => {
            return farmerService.register(input, await getDefaultOrganizationId());
        }),
});
