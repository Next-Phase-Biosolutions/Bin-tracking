// ─── @bin-tracker/validators ──────────────────────────────────
// Zod schemas for all API input validation

export { paginationSchema, type PaginationInput } from './common.schema.js';

export {
    binStartSchema,
    binStartDynamicSchema,
    binGetByIdSchema,
    binGetByQrCodeSchema,
    binListSchema,
    type BinStartInput,
    type BinStartDynamicInput,
    type BinListInput,
} from './bin.schema.js';

export {
    cyclePickupSchema,
    cycleDeliverSchema,
    cycleGetByIdSchema,
    cycleListSchema,
    cycleHistorySchema,
    type CyclePickupInput,
    type CycleDeliverInput,
    type CycleListInput,
    type CycleHistoryInput,
} from './cycle.schema.js';

export {
    createFacilitySchema,
    updateFacilitySchema,
    listFacilitiesSchema,
    getFacilitySchema,
    type CreateFacilityInput,
    type UpdateFacilityInput,
    type ListFacilitiesInput,
} from './facility.schema.js';

export {
    loginSchema,
    stationAuthSchema,
    type LoginInput,
    type StationAuthInput,
} from './auth.schema.js';
