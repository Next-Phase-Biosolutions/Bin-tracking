// ─── @bin-tracker/types ───────────────────────────────────────
// Shared TypeScript types for the Bin Tracking System

export type { Facility, Station, FacilityType, FacilityWithStations } from './facility.js';
export type { Bin, BinType, BinStatus, Urgency, BinWithType, BinWithDetails } from './bin.js';
export type {
    BinCycle,
    CycleStatus,
    ComplianceResult,
    CycleWithCountdown,
} from './cycle.js';
export type { EventLog, EventType } from './event.js';
export type { User, UserRole, UserInfo } from './user.js';
export type { Employee, EmployeeStatus } from './employee.js';
export type {
    AttendanceEventType,
    WorkSession,
    AttendanceEvent,
    AttendanceScanResult,
    EmployeeHoursSummary,
} from './attendance.js';
export type { Shipment, ShipmentCondition, ShipmentWithFacility } from './shipment.js';
export type {
    PayrollRunStatus,
    PayoutStatus,
    PayrollExceptionType,
    PayrollLineItemView,
    PayrollExceptionView,
    PayrollRunView,
    PayrollRunSummary,
} from './payroll.js';
export type {
    ApiSuccess,
    ApiError,
    ApiResponse,
    PaginationInput,
    PaginatedResponse,
    DashboardStats,
} from './api.js';
export type {
    FacilityWithDetails,
    CycleWithDetails,
    FacilityWithCycleCounts,
    BinWithActiveCycle,
} from './prisma.js';
export type {
    FieldType,
    FormField,
    FormTriggerTypeValue,
    FormFillFrequencyValue,
    ShowIfCondition,
    StandardSection,
    StandardSchema,
    ChecklistItem,
    ChecklistGroup,
    ChecklistSchema,
    MatrixColumn,
    MatrixRow,
    MatrixSchema,
    RepeatingColumn,
    RepeatingSchema,
    FormSchema,
    FormTypeValue,
    FormTemplate,
    FormDigitizeDraft,
} from './form.js';
export type { Plan, SubscriptionStatus, ModuleKey, PlanLimits } from './entitlements.js';
export { PLAN_LIMITS, PLAN_DEFAULT_MODULES, defaultModulesForPlan, isSubscriptionUsable } from './entitlements.js';
