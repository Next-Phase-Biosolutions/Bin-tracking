import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { User } from '@bin-tracker/db';
import { provisionOrganization } from './org-provision.service.js';
import { createTrialSubscription } from './billing.service.js';

export interface BootstrapUserView {
    id: string;
    email: string;
    name: string;
    role: string;
}

export interface BootstrapResult {
    user: BootstrapUserView;
    needsOrg: boolean;
}

/**
 * First authenticated call after Supabase signup/login (verifiedProcedure —
 * see trpc.ts). Creates the local User row on first call — `upsert` on `id`
 * makes this idempotent under both sequential repeats and a same-instant
 * concurrent double-call, unlike a find-then-create pair which would race.
 * Then reports whether the caller already belongs to an org.
 *
 * `jwtPayload` is null only under the DISABLE_AUTH dev bypass (verifiedProcedure
 * skips its own check in that mode) — context.ts has already resolved an
 * existing seeded admin user for every request there, so fall back to it
 * instead of crashing.
 */
export async function bootstrap(
    jwtPayload: { sub: string; email?: string } | null,
    fallbackUser: User | null,
): Promise<BootstrapResult> {
    let user: User;

    if (jwtPayload) {
        if (!jwtPayload.email) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'JWT is missing an email claim' });
        }
        const email = jwtPayload.email;
        user = await prisma.user.upsert({
            where: { id: jwtPayload.sub },
            update: {},
            create: {
                id: jwtPayload.sub,
                email,
                // Supabase's JWT carries no display-name claim we surface here
                // (see jwt.ts) — seed a placeholder from the email's local
                // part. Renaming via a profile screen isn't in scope for this task.
                name: email.split('@')[0] ?? email,
                // Least privilege: the GLOBAL role is informational once org
                // authorization reads OrganizationMember.role (Task 25) — a
                // blanket global ADMIN here was the raw material for the
                // privilege-escalation bug and stays a footgun for any future
                // code that checks user.role. Real authority comes from the
                // ADMIN membership provisionOrganization() grants the owner.
                role: 'WORKER',
            },
        });
    } else if (fallbackUser) {
        user = fallbackUser;
    } else {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const membership = await prisma.organizationMember.findFirst({ where: { userId: user.id } });

    return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        needsOrg: !membership,
    };
}

function slugify(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'org'
    );
}

/**
 * ponytail: linear existence-check loop (not an atomic reservation) — a
 * collision requires two orgs to slugify to the same base, which is rare,
 * and a public "name taken, try -2" bump reveals nothing sensitive about the
 * other org. Upgrade to a retry-on-P2002 wrapper around provisionOrganization
 * if concurrent signups with identical org names become common.
 */
async function generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 2;
    while (await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    return candidate;
}

export interface CreateOrganizationResult {
    orgId: string;
    slug: string;
}

/**
 * Creates the caller's first organization. `owner` always comes from the
 * authenticated request context — auth.router.ts passes `ctx.user`, never a
 * client-supplied id, so a caller can never provision themselves as the
 * owner of an org under someone else's identity.
 *
 * provisionOrganization (Task 9) creates the Organization/owner membership/
 * default BinTypes/Settings/Subscription row and already picks the right
 * plan+status via defaultPlanForNewOrg() (Task 13) — this function only adds
 * the real Stripe trial on top when BILLING_ENABLED=true.
 */
export async function createOrganization(owner: { id: string; email: string }, name: string): Promise<CreateOrganizationResult> {
    const slug = await generateUniqueSlug(name);
    const { orgId } = await provisionOrganization(prisma, { name, slug, ownerUserId: owner.id });

    if (process.env['BILLING_ENABLED'] === 'true') {
        await createTrialSubscription(orgId, owner.email);
    }

    return { orgId, slug };
}

export interface UpdateProfileResult {
    id: string;
    name: string;
    email: string;
}

/** Settings-page rename. userId is always ctx.user.id — never client input. */
export async function updateProfile(userId: string, name: string): Promise<UpdateProfileResult> {
    return prisma.user.update({
        where: { id: userId },
        data: { name },
        select: { id: true, name: true, email: true },
    });
}

export const authService = {
    bootstrap,
    createOrganization,
    updateProfile,
};
