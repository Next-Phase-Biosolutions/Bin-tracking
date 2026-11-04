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
    list: cardAdmin.query(({ ctx }) => nfcCardService.list(ctx.orgId)),
    create: cardAdmin.input(createNfcCardSchema).mutation(({ input, ctx }) => nfcCardService.create(ctx.orgId, input)),
    update: cardAdmin.input(updateNfcCardSchema).mutation(({ input, ctx }) => nfcCardService.update(ctx.orgId, input)),
    setActive: cardAdmin.input(setNfcCardActiveSchema).mutation(({ input, ctx }) => nfcCardService.setActive(ctx.orgId, input)),
    remove: cardAdmin.input(nfcCardRefSchema).mutation(({ input, ctx }) => nfcCardService.remove(ctx.orgId, input.id)),
});
