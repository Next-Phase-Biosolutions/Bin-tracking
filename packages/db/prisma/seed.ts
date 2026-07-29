import { PrismaClient, FacilityType, UserRole, BinStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, createHash } from 'crypto';
import { provisionOrganization, DEFAULT_BIN_TYPES } from '../src/org-provision.js';

// ─── Supabase Admin API helpers ────────────────────────────────────────────

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const ANON_KEY = process.env['SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    console.error('❌ Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY');
    process.exit(1);
}

function generateToken(): string {
    return randomBytes(32).toString('hex');
}

// Tokens are stored hashed at rest (see apps/api/src/lib/token.ts) — the DB
// gets the digest, the console gets the raw value for tablet setup.
function hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
}

async function adminFetch(path: string, init?: RequestInit) {
    return fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY!,
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
    });
}

// Get all existing Auth users (paginated)
async function listAuthUsers(): Promise<Array<{ id: string; email: string }>> {
    const res = await adminFetch('users?per_page=1000');
    const json = await res.json() as { users?: Array<{ id: string; email: string }> };
    return json.users ?? [];
}

// Delete an Auth user by UUID
async function deleteAuthUser(id: string): Promise<void> {
    await adminFetch(`users/${id}`, { method: 'DELETE' });
}

// Create an Auth user with confirmed email, returns their UUID
async function createAuthUser(email: string, password: string, name: string): Promise<string> {
    const res = await adminFetch('users', {
        method: 'POST',
        body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { name },
        }),
    });
    const data = await res.json() as { id?: string; message?: string };
    if (!res.ok || !data.id) {
        throw new Error(`Failed to create Auth user ${email}: ${JSON.stringify(data)}`);
    }
    return data.id;
}

/** Return existing Supabase Auth user id or create one — never deletes. */
async function getOrCreateAuthUser(
    email: string,
    password: string,
    name: string,
    existingAuth: Array<{ id: string; email: string }>,
): Promise<string> {
    const found = existingAuth.find((u) => u.email === email);
    if (found) {
        console.log(`  ↪ Auth user exists: ${email}`);
        return found.id;
    }
    const id = await createAuthUser(email, password, name);
    console.log(`  ✓ Created auth user: ${email}`);
    return id;
}

async function wipeDatabase(prisma: PrismaClient): Promise<void> {
    console.log('🧹 Cleaning existing data (SEED_FORCE=true)...');
    await prisma.payrollException.deleteMany();
    await prisma.payrollLineItem.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.attendanceEvent.deleteMany();
    await prisma.workSession.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.shipment.deleteMany();
    await prisma.formTemplate.deleteMany();
    await prisma.animalRegistration.deleteMany();
    await prisma.eventLog.deleteMany();
    await prisma.binCycle.deleteMany();
    await prisma.bin.deleteMany();
    await prisma.station.deleteMany();
    await prisma.binType.deleteMany();
    await prisma.userFacility.deleteMany();
    await prisma.user.deleteMany();
    await prisma.facility.deleteMany();
    // Cascades away Subscription/OrganizationMember/Invitation rows too.
    await prisma.organization.deleteMany();
}

async function wipeSeedAuthUsers(): Promise<void> {
    console.log('🔐 Removing seed Supabase Auth users (SEED_FORCE=true)...');
    const existingAuth = await listAuthUsers();
    const seedEmails = new Set(SEED_USERS.map((u) => u.email as string));
    for (const authUser of existingAuth.filter((u) => seedEmails.has(u.email))) {
        await deleteAuthUser(authUser.id);
        console.log(`  ✗ Deleted auth user: ${authUser.email}`);
    }
}

// ─── Seed data ─────────────────────────────────────────────────────────────

const SEED_USERS = [
    { email: 'admin@bintracker.com', name: 'System Admin', role: UserRole.ADMIN, password: 'Admin1234!' },
    { email: 'ops@bintracker.com', name: 'Ops Manager', role: UserRole.OPS_MANAGER, password: 'Ops1234!' },
    { email: 'driver1@bintracker.com', name: 'John Driver', role: UserRole.DRIVER, password: 'Driver1234!' },
    { email: 'driver2@bintracker.com', name: 'Jane Driver', role: UserRole.DRIVER, password: 'Driver1234!' },
    { email: 'worker1@bintracker.com', name: 'Bob Worker', role: UserRole.WORKER, password: 'Worker1234!' },
] as const;

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const seedForce = process.env['SEED_FORCE']?.toLowerCase() === 'true';
    const seedOnlyIfEmpty = process.env['SEED_ONLY_IF_EMPTY']?.toLowerCase() === 'true';

    if (isProduction && seedForce) {
        console.error('❌ SEED_FORCE is not allowed when NODE_ENV=production');
        process.exit(1);
    }

    if (isProduction && !seedOnlyIfEmpty) {
        console.error('❌ Production seed requires SEED_ONLY_IF_EMPTY=true');
        process.exit(1);
    }

    const connectionString =
        process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter, log: [] });

    if (seedOnlyIfEmpty) {
        const existing = await prisma.user.findFirst();
        if (existing) {
            console.log('✅ Database already seeded — skipping (SEED_ONLY_IF_EMPTY=true)');
            await prisma.$disconnect();
            return;
        }
    } else if (!seedForce && (await prisma.user.findFirst())) {
        console.error(
            '❌ Database is not empty. Set SEED_ONLY_IF_EMPTY=true to skip, or SEED_FORCE=true (dev only) to wipe first.',
        );
        process.exit(1);
    }

    if (seedForce) {
        await wipeDatabase(prisma);
        await wipeSeedAuthUsers();
    }

    // ─── Supabase Auth users → get or create (never delete in bootstrap mode) ─
    console.log('👤 Ensuring Supabase Auth users...');
    const existingAuth = await listAuthUsers();
    const authIds: Record<string, string> = {};
    for (const u of SEED_USERS) {
        authIds[u.email] = await getOrCreateAuthUser(
            u.email,
            u.password,
            u.name,
            existingAuth,
        );
    }

    // ─── Mirror users in our DB using Supabase Auth UUIDs ───
    console.log('📝 Creating database users...');
    const dbUsers = await Promise.all(
        SEED_USERS.map(u =>
            prisma.user.create({
                data: { id: authIds[u.email], email: u.email, name: u.name, role: u.role },
            }),
        ),
    );
    const [admin, ops, driver1, driver2] = dbUsers;

    // ─── Provision the default org (org + owner membership + bin types +
    // settings + subscription) via the shared provisioning path — same one
    // self-serve signup will use in a later phase. ───
    const { orgId } = await provisionOrganization(prisma, {
        name: 'Default Organization',
        slug: 'default',
        ownerUserId: admin!.id,
    });

    // ─── 5. Facilities ──────────────────────────────────────────
    console.log('🏭 Creating facilities...');
    const facilities = await Promise.all([
        prisma.facility.create({ data: { name: 'Chicago Processing', type: FacilityType.PROCESSING, address: '123 Industrial Blvd', city: 'Chicago', province: 'IL', postalCode: '60601', country: 'USA', organizationId: orgId } }),
        prisma.facility.create({ data: { name: 'Detroit Processing', type: FacilityType.PROCESSING, address: '456 Factory Ave', city: 'Detroit', province: 'MI', postalCode: '48201', country: 'USA', organizationId: orgId } }),
        prisma.facility.create({ data: { name: 'Milwaukee Processing', type: FacilityType.PROCESSING, address: '789 Plant Rd', city: 'Milwaukee', province: 'WI', postalCode: '53202', country: 'USA', organizationId: orgId } }),
        prisma.facility.create({ data: { name: 'Midwest Rendering', type: FacilityType.RENDERING, address: '321 Render Lane', city: 'Indianapolis', province: 'IN', postalCode: '46201', country: 'USA', organizationId: orgId } }),
        prisma.facility.create({ data: { name: 'Great Lakes Rendering', type: FacilityType.RENDERING, address: '654 Process Way', city: 'Columbus', province: 'OH', postalCode: '43215', country: 'USA', organizationId: orgId } }),
    ]);
    const [chicago, detroit, milwaukee] = facilities;

    // ─── 6. Assign users to facilities ──────────────────────────
    //  ADMIN has no assignments (role bypasses all facility checks)
    //  Ops Manager → Chicago + Detroit
    //  Driver1     → Chicago
    //  Driver2     → Detroit + Milwaukee
    console.log('🔗 Assigning users to facilities...');
    await Promise.all([
        prisma.userFacility.create({ data: { userId: ops!.id, facilityId: chicago!.id } }),
        prisma.userFacility.create({ data: { userId: ops!.id, facilityId: detroit!.id } }),
        prisma.userFacility.create({ data: { userId: driver1!.id, facilityId: chicago!.id } }),
        prisma.userFacility.create({ data: { userId: driver2!.id, facilityId: detroit!.id } }),
        prisma.userFacility.create({ data: { userId: driver2!.id, facilityId: milwaukee!.id } }),
    ]);

    // ─── 7. Stations (scanning tablets) ─────────────────────────
    console.log('📟 Creating stations...');
    const stationSpecs = [
        { facilityId: chicago!.id, label: 'Chicago Tablet 1' },
        { facilityId: chicago!.id, label: 'Chicago Tablet 2' },
        { facilityId: detroit!.id, label: 'Detroit Tablet 1' },
        { facilityId: milwaukee!.id, label: 'Milwaukee Tablet 1' },
    ].map((spec) => ({ ...spec, rawToken: generateToken() }));
    await Promise.all(
        stationSpecs.map((s) =>
            prisma.station.create({ data: { facilityId: s.facilityId, token: hashToken(s.rawToken), label: s.label } }),
        ),
    );
    console.log('   Raw station tokens (stored hashed — record these now, they are not recoverable):');
    for (const s of stationSpecs) console.log(`   ${s.label}: ${s.rawToken}`);

    // ─── 8. Bin Types ────────────────────────────────────────────
    // Already created by provisionOrganization() above — fetch them back in
    // the same order as DEFAULT_BIN_TYPES so binData below can still index
    // into them positionally (0=heart, 1=liver, 2=kidney, 3=skin, 4=fat, 5=bone).
    const seededBinTypes = await prisma.binType.findMany({ where: { organizationId: orgId } });
    const binTypeByOrganType = new Map(seededBinTypes.map((bt) => [bt.organType, bt]));
    const binTypes = DEFAULT_BIN_TYPES.map((bt) => binTypeByOrganType.get(bt.organType)!);

    // ─── 9. Bins ─────────────────────────────────────────────────
    console.log('🗑️  Creating bins...');
    const binData: Array<[number, number, number]> = [
        // [binTypeIdx, facilityIdx, serialNo]
        // Chicago — 8 bins
        [0, 0, 1], [0, 0, 2], [1, 0, 1], [2, 0, 1], [3, 0, 1], [4, 0, 1], [5, 0, 1], [5, 0, 2],
        // Detroit — 6 bins
        [0, 1, 3], [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2], [5, 1, 3],
        // Milwaukee — 6 bins
        [0, 2, 4], [1, 2, 3], [2, 2, 3], [3, 2, 3], [4, 2, 3], [5, 2, 4],
    ];

    await Promise.all(
        binData.map(([t, f, n]) =>
            prisma.bin.create({
                data: {
                    qrCode: `${binTypes[t]!.prefix}-${String(n).padStart(3, '0')}`,
                    binTypeId: binTypes[t]!.id,
                    currentFacilityId: facilities[f]!.id,
                    status: BinStatus.IDLE,
                    organizationId: orgId,
                },
            }),
        ),
    );

    // ─── Form Templates ──────────────────────────────────────
    // Already seeded by provisionOrganization() above via DEFAULT_FORM_TEMPLATES.
    console.log('📋 Form templates already seeded by provisionOrganization()');

    // ─── Done — print test guide ──────────────────────────────────
    console.log('\n✅ Seed complete!\n');    console.log('═══════════════════════════════════════════════════════════');
    console.log('  TEST ACCOUNTS');
    console.log('═══════════════════════════════════════════════════════════');
    for (const u of SEED_USERS) {
        console.log(`  ${u.role.padEnd(12)} │ ${u.email.padEnd(30)} │ ${u.password}`);
    }
    console.log('───────────────────────────────────────────────────────────');
    console.log('  FACILITY ACCESS');
    console.log('───────────────────────────────────────────────────────────');
    console.log('  ADMIN       → all facilities (no restriction)');
    console.log('  OPS_MANAGER → Chicago + Detroit');
    console.log('  driver1     → Chicago only');
    console.log('  driver2     → Detroit + Milwaukee');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n  Get a JWT (run in terminal):');
    console.log(`\n  curl -s -X POST '${SUPABASE_URL}/auth/v1/token?grant_type=password' \\`);
    console.log(`    -H 'apikey: ${ANON_KEY}' \\`);
    console.log(`    -H 'Content-Type: application/json' \\`);
    console.log(`    -d '{"email":"admin@bintracker.com","password":"Admin1234!"}' | jq .access_token`);
    console.log('\n  Then call the API:');
    console.log(`  curl -s http://localhost:3001/trpc/facility.list \\`);
    console.log(`    -H 'Authorization: Bearer <access_token>'`);
    console.log('');

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
});
