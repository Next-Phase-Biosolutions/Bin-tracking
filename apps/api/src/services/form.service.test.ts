import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { FormSubmissionValues } from '@bin-tracker/types';
import { formService } from './form.service.js';

// ─── In-memory Prisma fake ────────────────────────────────────
// form.service.ts takes `prisma` as an explicit parameter (ctx.prisma) rather
// than importing the singleton, so tests just pass a fake client directly —
// no vi.mock('@bin-tracker/db') needed.
//
// Regression focus: before this batch, listByStage()/getById() had no
// organizationId filter at all (real cross-tenant leaks), and create()'s
// maxSort aggregate had no org filter either — so sortOrder allocation for a
// new form in one org was influenced by another org's forms at the same stage.

interface FakeForm {
    id: string;
    organizationId: string;
    title: string;
    description: string | null;
    stage: string;
    formType: string;
    schema: unknown;
    sourceImageUrl: string | null;
    triggerType: string | null;
    triggerConfig: unknown;
    fillFrequency: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

function makeForm(overrides: Partial<FakeForm>): FakeForm {
    return {
        id: overrides.id ?? 'form-1',
        organizationId: overrides.organizationId ?? 'org-a',
        title: overrides.title ?? 'Intake Form',
        description: null,
        stage: overrides.stage ?? 'INTAKE',
        formType: 'standard',
        schema: { fields: [] },
        sourceImageUrl: null,
        triggerType: null,
        triggerConfig: null,
        fillFrequency: null,
        isActive: true,
        sortOrder: overrides.sortOrder ?? 0,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        ...overrides,
    };
}

function makeFakePrisma(forms: FakeForm[]) {
    return {
        formTemplate: {
            findMany: ({ where }: { where: { organizationId: string; stage?: string; isActive?: boolean } }) =>
                Promise.resolve(
                    forms.filter(
                        (f) =>
                            f.organizationId === where.organizationId &&
                            (!where.stage || f.stage === where.stage) &&
                            (where.isActive === undefined || f.isActive === where.isActive),
                    ),
                ),
            findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(forms.find((f) => f.id === where.id) ?? null),
            aggregate: ({ where }: { where: { organizationId: string; stage: string } }) => {
                const matching = forms.filter((f) => f.organizationId === where.organizationId && f.stage === where.stage);
                const max = matching.length > 0 ? Math.max(...matching.map((f) => f.sortOrder)) : null;
                return Promise.resolve({ _max: { sortOrder: max } });
            },
            create: ({ data }: { data: Omit<FakeForm, 'id' | 'createdAt' | 'updatedAt'> }) => {
                const row = makeForm({ id: `form-${forms.length + 1}`, ...data });
                forms.push(row);
                return Promise.resolve(row);
            },
        },
    } as unknown as PrismaClient;
}

describe('formService.listByStage', () => {
    it('only returns forms belonging to the requesting org', async () => {
        const forms = [makeForm({ id: 'form-a', organizationId: 'org-a' }), makeForm({ id: 'form-b', organizationId: 'org-b' })];
        const prisma = makeFakePrisma(forms);

        const result = await formService.listByStage(prisma, 'org-a', 'ALL');

        expect(result.map((f) => f.id)).toEqual(['form-a']);
    });
});

describe('formService.getById', () => {
    it('returns null (not the row) for a form in another org', async () => {
        const forms = [makeForm({ id: 'form-b', organizationId: 'org-b' })];
        const prisma = makeFakePrisma(forms);

        const result = await formService.getById(prisma, 'org-a', 'form-b');

        expect(result).toBeNull();
    });
});

describe('formService.create', () => {
    it("does not let another org's forms at the same stage influence sortOrder allocation", async () => {
        const forms = [
            makeForm({ id: 'form-b-1', organizationId: 'org-b', stage: 'INTAKE', sortOrder: 5 }),
            makeForm({ id: 'form-b-2', organizationId: 'org-b', stage: 'INTAKE', sortOrder: 6 }),
        ];
        const prisma = makeFakePrisma(forms);

        const created = await formService.create(
            prisma,
            {
                title: 'New Org A Form',
                stage: 'INTAKE',
                formType: 'standard',
                schema: { formType: 'standard', sections: [] },
            } as never,
            'org-a',
        );

        // org-a has no existing INTAKE forms, so this must start at 0 —
        // not 7, which is what org-b's max + 1 would produce.
        expect(created.sortOrder).toBe(0);
    });
});

// ─── FormSubmission ────────────────────────────────────────────
// Separate fake: submit/listSubmissions/getSubmission/updateSubmission touch
// formTemplate, user, formSubmission and formSubmissionAuditLog together,
// so this fake tracks all four instead of stretching FakeForm/makeFakePrisma
// above (which only ever needed formTemplate).

interface FakeUser {
    id: string;
    name: string;
}

interface FakeSubmission {
    id: string;
    formId: string;
    organizationId: string;
    submittedByUserId: string | null;
    values: FormSubmissionValues;
    createdAt: Date;
}

interface FakeAuditLog {
    id: string;
    submissionId: string;
    orgId: string;
    actorId: string | null;
    oldValue: FormSubmissionValues;
    newValue: FormSubmissionValues;
    createdAt: Date;
}

const STANDARD_SCHEMA_ONE_REQUIRED_FIELD = {
    formType: 'standard' as const,
    sections: [
        {
            id: 'header',
            title: null,
            fields: [{ id: 'name', type: 'text' as const, label: 'Name', required: true }],
        },
    ],
};

function makeSubmissionFixtures(overrides: {
    forms?: Partial<FakeForm>[];
    users?: FakeUser[];
    submissions?: Partial<FakeSubmission>[];
}) {
    const forms: FakeForm[] = (overrides.forms ?? []).map((f) =>
        makeForm({ schema: STANDARD_SCHEMA_ONE_REQUIRED_FIELD, ...f }),
    );
    const users: FakeUser[] = overrides.users ?? [];
    const submittedBy = (s: FakeSubmission) => users.find((u) => u.id === s.submittedByUserId) ?? null;
    const submissions: FakeSubmission[] = (overrides.submissions ?? []).map((s) => ({
        id: s.id ?? 'submission-1',
        formId: s.formId ?? 'form-1',
        organizationId: s.organizationId ?? 'org-a',
        submittedByUserId: s.submittedByUserId ?? 'user-1',
        values: s.values ?? { formType: 'standard', values: { name: 'Abdul' }, tableRows: {} },
        createdAt: s.createdAt ?? new Date('2026-08-01T00:00:00.000Z'),
    }));
    const auditLogs: FakeAuditLog[] = [];

    const prisma = {
        formTemplate: {
            findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(forms.find((f) => f.id === where.id) ?? null),
        },
        formSubmission: {
            create: ({ data }: { data: Omit<FakeSubmission, 'id' | 'createdAt'> }) => {
                const row: FakeSubmission = { id: `submission-${submissions.length + 1}`, createdAt: new Date(), ...data };
                submissions.push(row);
                return Promise.resolve(row);
            },
            findMany: ({ where }: { where: { organizationId: string; formId?: string; form?: { stage: string } } }) =>
                Promise.resolve(
                    submissions
                        .filter((s) => s.organizationId === where.organizationId)
                        .filter((s) => !where.formId || s.formId === where.formId)
                        .map((s) => ({
                            ...s,
                            form: forms.find((f) => f.id === s.formId)!,
                            submittedBy: submittedBy(s),
                        })),
                ),
            findUnique: ({ where }: { where: { id: string } }) => {
                const s = submissions.find((sub) => sub.id === where.id);
                if (!s) return Promise.resolve(null);
                return Promise.resolve({
                    ...s,
                    form: forms.find((f) => f.id === s.formId)!,
                    submittedBy: submittedBy(s),
                    auditLogs: auditLogs.filter((a) => a.submissionId === s.id),
                });
            },
            update: ({ where, data }: { where: { id: string }; data: Partial<FakeSubmission> }) => {
                const idx = submissions.findIndex((s) => s.id === where.id);
                submissions[idx] = { ...submissions[idx]!, ...data };
                return Promise.resolve(submissions[idx]);
            },
        },
        formSubmissionAuditLog: {
            create: ({ data }: { data: Omit<FakeAuditLog, 'id' | 'createdAt'> }) => {
                const row: FakeAuditLog = { id: `audit-${auditLogs.length + 1}`, createdAt: new Date(), ...data };
                auditLogs.push(row);
                return Promise.resolve(row);
            },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $transaction: (fn: (tx: any) => Promise<unknown>) => fn(prisma),
    };

    return { prisma: prisma as unknown as PrismaClient, submissions, auditLogs };
}

describe('formService.submit', () => {
    it('rejects NOT_FOUND when the form belongs to another org', async () => {
        const { prisma } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-b' }],
        });

        await expect(
            formService.submit(
                prisma,
                { formId: 'form-1', values: { formType: 'standard', values: { name: 'X' }, tableRows: {} } },
                'org-a',
                'user-1',
            ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects BAD_REQUEST when a required field is missing', async () => {
        const { prisma } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-a' }],
        });

        await expect(
            formService.submit(
                prisma,
                { formId: 'form-1', values: { formType: 'standard', values: {}, tableRows: {} } },
                'org-a',
                'user-1',
            ),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('creates the submission with the acting user recorded', async () => {
        const { prisma, submissions } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-a' }],
        });

        const result = await formService.submit(
            prisma,
            { formId: 'form-1', values: { formType: 'standard', values: { name: 'Abdul' }, tableRows: {} } },
            'org-a',
            'user-42',
        );

        expect(result.submittedByUserId).toBe('user-42');
        expect(submissions).toHaveLength(1);
    });

    it('allows a null submittedByUserId (DISABLE_AUTH mode has no ctx.user)', async () => {
        const { prisma } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-a' }],
        });

        const result = await formService.submit(
            prisma,
            { formId: 'form-1', values: { formType: 'standard', values: { name: 'Abdul' }, tableRows: {} } },
            'org-a',
            null,
        );

        expect(result.submittedByUserId).toBeNull();
    });
});

describe('formService.listSubmissions', () => {
    it('only returns submissions belonging to the requesting org', async () => {
        const { prisma } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-a' }],
            submissions: [
                { id: 'sub-a', organizationId: 'org-a', formId: 'form-1' },
                { id: 'sub-b', organizationId: 'org-b', formId: 'form-1' },
            ],
        });

        const result = await formService.listSubmissions(prisma, 'org-a', {});

        expect(result.map((s) => s.id)).toEqual(['sub-a']);
    });
});

describe('formService.getSubmission', () => {
    it('returns null (not the row) for a submission in another org', async () => {
        const { prisma } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-b' }],
            submissions: [{ id: 'sub-b', organizationId: 'org-b' }],
        });

        const result = await formService.getSubmission(prisma, 'org-a', 'sub-b');

        expect(result).toBeNull();
    });

    it('returns the full detail — submission, form title/schema, submitter name, audit trail — for a same-org submission', async () => {
        const { prisma } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-a', title: 'Daily Bin Form' }],
            users: [{ id: 'user-1', name: 'Abdul Bin' }],
            submissions: [{ id: 'sub-a', organizationId: 'org-a', submittedByUserId: 'user-1' }],
        });

        const result = await formService.getSubmission(prisma, 'org-a', 'sub-a');

        expect(result?.formTitle).toBe('Daily Bin Form');
        expect(result?.submittedByName).toBe('Abdul Bin');
        expect(result?.auditLogs).toEqual([]);
    });
});

describe('formService.updateSubmission', () => {
    it('rejects NOT_FOUND when the submission belongs to another org', async () => {
        const { prisma } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-b' }],
            submissions: [{ id: 'sub-b', organizationId: 'org-b' }],
        });

        await expect(
            formService.updateSubmission(
                prisma,
                { id: 'sub-b', values: { formType: 'standard', values: { name: 'Fixed' }, tableRows: {} } },
                'org-a',
                'admin-1',
            ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects BAD_REQUEST when the correction would leave a required field missing', async () => {
        const { prisma } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-a' }],
            submissions: [{ id: 'sub-a', organizationId: 'org-a', formId: 'form-1' }],
        });

        await expect(
            formService.updateSubmission(
                prisma,
                { id: 'sub-a', values: { formType: 'standard', values: {}, tableRows: {} } },
                'org-a',
                'admin-1',
            ),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('writes exactly one audit log row with the correct old/new snapshot and updates the submission', async () => {
        const { prisma, submissions, auditLogs } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-a' }],
            submissions: [
                {
                    id: 'sub-a',
                    organizationId: 'org-a',
                    formId: 'form-1',
                    values: { formType: 'standard', values: { name: 'Typo' }, tableRows: {} },
                },
            ],
        });

        const result = await formService.updateSubmission(
            prisma,
            { id: 'sub-a', values: { formType: 'standard', values: { name: 'Fixed' }, tableRows: {} } },
            'org-a',
            'admin-1',
        );

        expect(result.values).toEqual({ formType: 'standard', values: { name: 'Fixed' }, tableRows: {} });
        expect(submissions[0]?.values).toEqual({ formType: 'standard', values: { name: 'Fixed' }, tableRows: {} });

        expect(auditLogs).toHaveLength(1);
        expect(auditLogs[0]).toMatchObject({
            submissionId: 'sub-a',
            orgId: 'org-a',
            actorId: 'admin-1',
            oldValue: { formType: 'standard', values: { name: 'Typo' }, tableRows: {} },
            newValue: { formType: 'standard', values: { name: 'Fixed' }, tableRows: {} },
        });
    });

    // oldValue used to come from a read taken BEFORE the transaction, so two
    // admins correcting the same submission both recorded the same pre-edit
    // snapshot — the second one's audit row claimed it replaced a value the
    // first had already overwritten.
    it('records oldValue as the row the update actually replaces, not a snapshot read before the transaction', async () => {
        const { prisma, submissions, auditLogs } = makeSubmissionFixtures({
            forms: [{ id: 'form-1', organizationId: 'org-a' }],
            submissions: [
                {
                    id: 'sub-a',
                    organizationId: 'org-a',
                    formId: 'form-1',
                    values: { formType: 'standard', values: { name: 'Original' }, tableRows: {} },
                },
            ],
        });

        await formService.updateSubmission(
            prisma,
            { id: 'sub-a', values: { formType: 'standard', values: { name: 'First edit' }, tableRows: {} } },
            'org-a',
            'admin-1',
        );
        await formService.updateSubmission(
            prisma,
            { id: 'sub-a', values: { formType: 'standard', values: { name: 'Second edit' }, tableRows: {} } },
            'org-a',
            'admin-2',
        );

        expect(submissions[0]?.values).toEqual({ formType: 'standard', values: { name: 'Second edit' }, tableRows: {} });
        expect(auditLogs).toHaveLength(2);
        // The second correction replaced "First edit", not the original.
        expect(auditLogs[1]).toMatchObject({
            actorId: 'admin-2',
            oldValue: { formType: 'standard', values: { name: 'First edit' }, tableRows: {} },
            newValue: { formType: 'standard', values: { name: 'Second edit' }, tableRows: {} },
        });
    });
});
