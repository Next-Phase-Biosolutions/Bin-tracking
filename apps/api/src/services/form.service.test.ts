import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
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
