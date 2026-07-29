import { prisma } from './client.js';
import { DEFAULT_FORM_TEMPLATES } from './default-form-templates.js';

const dryRun = process.argv.includes('--dry-run');

/**
 * One-time backfill: ensures every existing org has all 6 DEFAULT_FORM_TEMPLATES.
 * Idempotent by exact title match within the org — an org that already has a
 * form titled e.g. "Est 183 Feeding and Watering Livestock" is left alone,
 * near-matches (typos, stale duplicates) are NOT deduped or touched. New orgs
 * get this for free via provisionOrganization(); this only covers orgs that
 * predate that change.
 */
async function main(): Promise<void> {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });

    for (const org of orgs) {
        const existing = await prisma.formTemplate.findMany({
            where: { organizationId: org.id },
            select: { title: true, stage: true, sortOrder: true },
        });
        const existingTitles = new Set(existing.map((f) => f.title));

        const maxSortOrderByStage = new Map<string, number>();
        for (const f of existing) {
            maxSortOrderByStage.set(f.stage, Math.max(maxSortOrderByStage.get(f.stage) ?? -1, f.sortOrder));
        }

        const toInsert = DEFAULT_FORM_TEMPLATES.filter((form) => !existingTitles.has(form.title));

        if (toInsert.length === 0) {
            console.log(`${org.name}: 0 to insert (all ${DEFAULT_FORM_TEMPLATES.length} already present)`);
            continue;
        }

        if (dryRun) {
            console.log(`${org.name}: would insert ${toInsert.length} (${toInsert.map((f) => f.title).join(', ')})`);
            continue;
        }

        for (const form of toInsert) {
            const sortOrder = (maxSortOrderByStage.get(form.stage) ?? -1) + 1;
            maxSortOrderByStage.set(form.stage, sortOrder);
            await prisma.formTemplate.create({ data: { ...form, sortOrder, organizationId: org.id } });
        }
        console.log(`${org.name}: inserted ${toInsert.length} (${toInsert.map((f) => f.title).join(', ')})`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
