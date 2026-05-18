import type { PrismaClient } from '@prisma/client';
import type { FormTemplate } from '@bin-tracker/types';

function toFormTemplate(raw: {
    id: string;
    title: string;
    description: string | null;
    stage: string;
    formType: string;
    schema: unknown;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}): FormTemplate {
    return raw as unknown as FormTemplate;
}

export const formService = {
    async listByStage(prisma: PrismaClient, stage: string): Promise<FormTemplate[]> {
        const rows = await prisma.formTemplate.findMany({
            // When stage is 'ALL' or empty, return every active form
            where: stage && stage !== 'ALL' ? { stage, isActive: true } : { isActive: true },
            orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
        });
        return rows.map(toFormTemplate);
    },

    async getById(prisma: PrismaClient, id: string): Promise<FormTemplate | null> {
        const row = await prisma.formTemplate.findUnique({ where: { id } });
        if (!row) return null;
        return toFormTemplate(row);
    },
};
