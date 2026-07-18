import { router, orgProcedure, requireModule } from '../trpc/trpc.js';
import { transcribeAudioSchema, animalRegistrationSchema } from '@bin-tracker/validators';
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
});
