import { router, orgOpsProcedure, requireModule } from '../trpc/trpc.js';
import {
    createNfcCardSchema,
    updateNfcCardSchema,
    nfcCardRefSchema,
    setNfcCardActiveSchema,
} from '@bin-tracker/validators';
import { nfcCardService } from '../services/nfc-card.service.js';

// Managing cards is ADMIN / OPS_MANAGER only, inside the WORKFORCE module.
const cardAdmin = orgOpsProcedure.use(requireModule('WORKFORCE'));

export const nfcCardRouter = router({
    /**
     * The origin to write into tag URLs: the server's APP_URL, the same origin registration
     * links use and the one cookie-authenticated calls are required to come from. The admin's
     * own browser origin (www, a Netlify preview) may differ, and a tag written with it would
     * never work.
     */
    tagBaseUrl: cardAdmin.query(() => ({ url: (process.env['APP_URL'] ?? 'http://localhost:3000').replace(/\/$/, '') })),

    list: cardAdmin.query(({ ctx }) => nfcCardService.list(ctx.orgId)),
    create: cardAdmin.input(createNfcCardSchema).mutation(({ input, ctx }) => nfcCardService.create(ctx.orgId, input)),
    update: cardAdmin.input(updateNfcCardSchema).mutation(({ input, ctx }) => nfcCardService.update(ctx.orgId, input)),
    setActive: cardAdmin.input(setNfcCardActiveSchema).mutation(({ input, ctx }) => nfcCardService.setActive(ctx.orgId, input)),
    remove: cardAdmin.input(nfcCardRefSchema).mutation(({ input, ctx }) => nfcCardService.remove(ctx.orgId, input.id)),
});
