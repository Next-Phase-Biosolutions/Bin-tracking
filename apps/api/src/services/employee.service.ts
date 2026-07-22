import { randomBytes, randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { SafeEmployee } from '@bin-tracker/db';
import { PLAN_LIMITS } from '@bin-tracker/types';
import type {
    EmployeeRegisterInput,
    EmployeeListInput,
    EmployeeBankSubmitInput,
} from '@bin-tracker/validators';
import type { UserRole } from '@prisma/client';
import { handlePrismaError } from '../lib/errors.js';
import { hashToken } from '../lib/token.js';
import { encryptBankField, last4 } from '../lib/bank-crypto.js';
import { sendBankDetailsRequestEmail } from '../lib/email.js';
import { captureError } from '../lib/sentry.js';

// Unambiguous alphabet (no 0/O/1/I) for human-readable employee codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateEmployeeCode(): string {
    const bytes = randomBytes(6);
    let code = '';
    for (const byte of bytes) {
        code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
    return `EMP-${code}`;
}

function generateQrToken(): string {
    return `ATT-${randomUUID()}`;
}

const BANK_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, same as invitations

/**
 * Individual pay rates are a PAYROLL-module feature and management data:
 * visible only when the org's PAYROLL module is enabled AND the viewer is
 * ADMIN/OPS_MANAGER. Otherwise hourlyRateCents is nulled out of the read (the
 * field is already nullable, so the type is unchanged). The stored values are
 * never deleted on a module toggle — hidden while OFF, back when re-enabled.
 */
function roleMaySeeRates(role: UserRole | null): boolean {
    return role === 'ADMIN' || role === 'OPS_MANAGER';
}

async function orgPayrollEnabled(orgId: string): Promise<boolean> {
    const row = await prisma.organizationModule.findUnique({
        where: { orgId_module: { orgId, module: 'PAYROLL' } },
    });
    return row?.enabled ?? false;
}

/** role check first — it's free — so non-privileged viewers never cost a module query. */
async function viewerSeesRates(orgId: string, role: UserRole | null): Promise<boolean> {
    return roleMaySeeRates(role) && (await orgPayrollEnabled(orgId));
}

function redactRate(employee: SafeEmployee, showRates: boolean): SafeEmployee {
    if (showRates) return employee;
    return { ...employee, hourlyRateCents: null };
}

export const employeeService = {
    /**
     * Register an employee (one-time) and mint a unique, permanent QR token.
     * Retries on the rare code/token collision.
     */
    async register(input: EmployeeRegisterInput, organizationId: string): Promise<SafeEmployee> {
        // Rates are a PAYROLL-module feature. Registration itself is WORKFORCE
        // and must keep working with PAYROLL off — but a rate supplied while the
        // module is off is rejected loudly rather than silently dropped into a
        // column the org can't see.
        if (input.hourlyRateCents != null && !(await orgPayrollEnabled(organizationId))) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Per-employee rates require the Payroll module. Enable it or omit the rate.',
            });
        }

        // Every org gets a Subscription row at provisioning time (org-provision.ts),
        // so this should always resolve — if it's ever missing, skip the quantity
        // check rather than block employee registration on an unrelated invariant break.
        const subscription = await prisma.subscription.findUnique({ where: { orgId: organizationId } });
        const maxEmployees = subscription ? PLAN_LIMITS[subscription.plan].maxEmployees : -1;
        if (maxEmployees !== -1) {
            const count = await prisma.employee.count({ where: { organizationId, status: 'ACTIVE' } });
            if (count >= maxEmployees) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: `Your plan allows up to ${maxEmployees} employees. Upgrade your plan to add more.`,
                });
            }
        }

        const MAX_ATTEMPTS = 5;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            try {
                return await prisma.employee.create({
                    data: {
                        employeeCode: generateEmployeeCode(),
                        qrCode: generateQrToken(),
                        fullName: input.fullName,
                        email: input.email ?? null,
                        phone: input.phone ?? null,
                        department: input.department ?? null,
                        position: input.position ?? null,
                        hourlyRateCents: input.hourlyRateCents ?? null,
                        organizationId,
                    },
                });
            } catch (error: unknown) {
                // P2002 = unique collision on employeeCode/qrCode — retry with new values.
                const isCollision =
                    typeof error === 'object' &&
                    error !== null &&
                    'code' in error &&
                    (error as { code?: string }).code === 'P2002';
                if (isCollision && attempt < MAX_ATTEMPTS - 1) continue;
                handlePrismaError(error);
            }
        }

        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not generate a unique employee code. Please retry.',
        });
    },

    async list(orgId: string, input: EmployeeListInput, viewerRole: UserRole | null): Promise<SafeEmployee[]> {
        const search = input.search?.trim();
        const employees = await prisma.employee.findMany({
            where: {
                organizationId: orgId,
                ...(input.status ? { status: input.status } : {}),
                ...(search
                    ? {
                          OR: [
                              { fullName: { contains: search, mode: 'insensitive' as const } },
                              { employeeCode: { contains: search, mode: 'insensitive' as const } },
                              { department: { contains: search, mode: 'insensitive' as const } },
                          ],
                      }
                    : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: input.limit,
        });
        const showRates = await viewerSeesRates(orgId, viewerRole);
        return employees.map((e) => redactRate(e, showRates));
    },

    async getById(orgId: string, id: string, viewerRole: UserRole | null): Promise<SafeEmployee> {
        const [employee, showRates] = await Promise.all([
            getEmployeeInOrg(orgId, id),
            viewerSeesRates(orgId, viewerRole),
        ]);
        return redactRate(employee, showRates);
    },

    /**
     * Set (or clear, with null) an employee's per-employee pay rate override.
     * Routed through getEmployeeInOrg first, so an employeeId from another org
     * fails NOT_FOUND before the update by verified id. Caller is ops+admin only
     * (employee.router), so the returned row always shows the rate. Audited:
     * who changed whose rate from what to what, in the same transaction.
     */
    async setHourlyRate(
        orgId: string,
        employeeId: string,
        hourlyRateCents: number | null,
        actorId: string,
    ): Promise<SafeEmployee> {
        const existing = await getEmployeeInOrg(orgId, employeeId);
        const [updated] = await prisma.$transaction([
            prisma.employee.update({ where: { id: employeeId }, data: { hourlyRateCents } }),
            prisma.payrollAuditLog.create({
                data: {
                    orgId,
                    actorId,
                    action: 'employee.setHourlyRate',
                    targetId: employeeId,
                    oldValue: { hourlyRateCents: existing.hourlyRateCents },
                    newValue: { hourlyRateCents },
                },
            }),
        ]);
        return updated;
    },

    // ─── Bank details (EFT payout) ────────────────────────────────────────
    // Bank PII never passes through an admin: the employee receives a
    // single-use link and types their own details. Admins only ever see the
    // ****1234 mask (bankAccountLast4).

    /**
     * Mints a one-time bank-details link and emails it to the employee.
     *
     * Re-requesting rotates the token rather than accumulating rows (mirrors
     * createInvitation) — so "Resend" comes for free and an old, possibly
     * forwarded, link stops working the moment a new one is issued.
     */
    async requestBankDetails(orgId: string, employeeId: string): Promise<{ email: string; expiresAt: Date }> {
        const employee = await getEmployeeInOrg(orgId, employeeId);

        if (!employee.email) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `${employee.fullName} has no email address on file — add one before requesting bank details.`,
            });
        }

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true },
        });
        if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });

        // Stored hashed at rest (lib/token.ts); only the emailed link ever
        // carries the raw token.
        const rawToken = randomUUID();
        const expiresAt = new Date(Date.now() + BANK_LINK_TTL_MS);
        await prisma.employee.update({
            where: { id: employee.id },
            data: { bankLinkToken: hashToken(rawToken), bankLinkExpiresAt: expiresAt },
        });

        const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';
        await sendBankDetailsRequestEmail(employee.email, `${appUrl}/app/bank-details/${rawToken}`, org.name);

        return { email: employee.email, expiresAt };
    },

    /**
     * Resolves a link token to the minimal context the public page needs.
     *
     * Returns nothing the holder doesn't already know — the email is the very
     * address the link was delivered to — so a leaked token discloses no new
     * PII. It only lets someone SUBMIT details, which the employee would then
     * see has already been done.
     *
     * `email` is returned so the form can prefill it: submitting writes this
     * column, and a typo on a blank field would silently overwrite the
     * employer's good contact address for this employee.
     */
    async getBankLinkContext(
        rawToken: string,
    ): Promise<{ employeeFullName: string; organizationName: string; email: string }> {
        const employee = await findEmployeeByBankLink(rawToken);
        const org = await prisma.organization.findUnique({
            where: { id: employee.organizationId },
            select: { name: true },
        });

        return {
            employeeFullName: employee.fullName,
            organizationName: org?.name ?? 'Your employer',
            // A link can only be issued to an employee WITH an email
            // (requestBankDetails enforces it), so this is always set.
            email: employee.email ?? '',
        };
    },

    /**
     * Stores the employee's own submission. The token is the SOLE credential:
     * the row is found by token alone and the organization comes from that
     * row, never from caller input — there is no session here to check.
     *
     * The link is cleared on success, so it works exactly once.
     */
    async submitBankDetails(input: EmployeeBankSubmitInput): Promise<{ ok: true }> {
        const employee = await findEmployeeByBankLink(input.token);

        // Encrypt OUTSIDE the try below, deliberately. A missing or malformed
        // BANK_DETAILS_KEY is an operator misconfiguration, not a bad
        // submission: swallowing it into the generic "try the link again"
        // message would leave an admin watching every employee fail forever
        // with nothing in the logs to explain it. bank-crypto's errors are
        // static strings that never contain the submitted values, so they are
        // safe to propagate.
        const encrypted = {
            bankInstitution: encryptBankField(input.bankInstitution),
            bankTransit: encryptBankField(input.bankTransit),
            bankAccount: encryptBankField(input.bankAccount),
            accountHolderName: encryptBankField(input.accountHolderName),
        };

        try {
            await prisma.employee.update({
                where: { id: employee.id },
                data: {
                    ...encrypted,
                    accountType: input.accountType,
                    bankAccountLast4: last4(input.bankAccount),
                    bankDetailsAt: new Date(),
                    email: input.email,
                    // Burn the link.
                    bankLinkToken: null,
                    bankLinkExpiresAt: null,
                },
            });
        } catch (error: unknown) {
            // The DB error itself must not reach the employee — a Prisma
            // message can echo the values it failed to write. Report it to
            // Sentry (request bodies are disabled there, see lib/sentry.ts) so
            // the failure is diagnosable, and return something generic.
            captureError(error, employee.organizationId);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Could not save your bank details. Please try the link again.',
            });
        }

        return { ok: true };
    },
};

/**
 * Org-scoped fetch. A cross-org mismatch reports as NOT_FOUND (never
 * FORBIDDEN) — same discipline as cycle.service.ts — so a caller can't
 * distinguish "doesn't exist" from "exists but isn't yours". Kept as a
 * free function rather than `this.getById` so callers inside this module
 * don't depend on how the service object is invoked.
 */
async function getEmployeeInOrg(orgId: string, id: string): Promise<SafeEmployee> {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee || employee.organizationId !== orgId) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employee not found',
        });
    }
    return employee;
}

/**
 * Looks an employee up by a raw bank-link token. Unknown, expired and
 * already-used tokens all fail identically — a caller must not be able to
 * distinguish "never existed" from "already submitted".
 */
async function findEmployeeByBankLink(rawToken: string): Promise<SafeEmployee> {
    const employee = await prisma.employee.findUnique({
        where: { bankLinkToken: hashToken(rawToken) },
    });

    if (!employee || !employee.bankLinkExpiresAt || employee.bankLinkExpiresAt.getTime() < Date.now()) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'This link is no longer valid. Ask your employer to send a new one.',
        });
    }

    return employee;
}
