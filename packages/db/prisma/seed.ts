import { PrismaClient, FacilityType, Urgency, UserRole, BinStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes } from 'crypto';

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
    const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
    const prisma = new PrismaClient({ adapter, log: [] });

    // ─── 1. Clean DB (order matters — FK constraints) ──────────
    console.log('🧹 Cleaning existing data...');
    await prisma.eventLog.deleteMany();
    await prisma.binCycle.deleteMany();
    await prisma.bin.deleteMany();
    await prisma.station.deleteMany();
    await prisma.binType.deleteMany();
    await prisma.userFacility.deleteMany();
    await prisma.user.deleteMany();
    await prisma.facility.deleteMany();

    // ─── 2. Clean Supabase Auth (remove old seed users) ────────
    console.log('🔐 Cleaning Supabase Auth users...');
    const existingAuth = await listAuthUsers();
    const seedEmails = new Set(SEED_USERS.map(u => u.email as string));
    for (const authUser of existingAuth.filter(u => seedEmails.has(u.email))) {
        await deleteAuthUser(authUser.id);
        console.log(`  ✗ Deleted old auth user: ${authUser.email}`);
    }

    // ─── 3. Create Supabase Auth users → get real UUIDs ────────
    console.log('👤 Creating Supabase Auth users...');
    const authIds: Record<string, string> = {};
    for (const u of SEED_USERS) {
        authIds[u.email] = await createAuthUser(u.email, u.password, u.name);
        console.log(`  ✓ ${u.role.padEnd(12)} ${u.email}`);
    }

    // ─── 4. Mirror users in our DB using Supabase Auth UUIDs ───
    console.log('📝 Creating database users...');
    const dbUsers = await Promise.all(
        SEED_USERS.map(u =>
            prisma.user.create({
                data: { id: authIds[u.email], email: u.email, name: u.name, role: u.role },
            }),
        ),
    );
    const [, ops, driver1, driver2] = dbUsers;

    // ─── 5. Facilities ──────────────────────────────────────────
    console.log('🏭 Creating facilities...');
    const facilities = await Promise.all([
        prisma.facility.create({ data: { name: 'Chicago Processing', type: FacilityType.PROCESSING, address: '123 Industrial Blvd, Chicago, IL 60601', lat: 41.8781, lng: -87.6298 } }),
        prisma.facility.create({ data: { name: 'Detroit Processing', type: FacilityType.PROCESSING, address: '456 Factory Ave, Detroit, MI 48201', lat: 42.3314, lng: -83.0458 } }),
        prisma.facility.create({ data: { name: 'Milwaukee Processing', type: FacilityType.PROCESSING, address: '789 Plant Rd, Milwaukee, WI 53202', lat: 43.0389, lng: -87.9065 } }),
        prisma.facility.create({ data: { name: 'Midwest Rendering', type: FacilityType.RENDERING, address: '321 Render Lane, Indianapolis, IN 46201', lat: 39.7684, lng: -86.1581 } }),
        prisma.facility.create({ data: { name: 'Great Lakes Rendering', type: FacilityType.RENDERING, address: '654 Process Way, Columbus, OH 43215', lat: 39.9612, lng: -82.9988 } }),
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
    await Promise.all([
        prisma.station.create({ data: { facilityId: chicago!.id, token: generateToken(), label: 'Chicago Tablet 1' } }),
        prisma.station.create({ data: { facilityId: chicago!.id, token: generateToken(), label: 'Chicago Tablet 2' } }),
        prisma.station.create({ data: { facilityId: detroit!.id, token: generateToken(), label: 'Detroit Tablet 1' } }),
        prisma.station.create({ data: { facilityId: milwaukee!.id, token: generateToken(), label: 'Milwaukee Tablet 1' } }),
    ]);

    // ─── 8. Bin Types ────────────────────────────────────────────
    console.log('📦 Creating bin types...');
    const binTypes = await Promise.all([
        prisma.binType.create({ data: { organType: 'heart', dkHours: 4, urgency: Urgency.CRITICAL, prefix: 'BIN-HEART', masterQrCode: 'TYPE-HEART' } }),
        prisma.binType.create({ data: { organType: 'liver', dkHours: 6, urgency: Urgency.CRITICAL, prefix: 'BIN-LIVER', masterQrCode: 'TYPE-LIVER' } }),
        prisma.binType.create({ data: { organType: 'kidney', dkHours: 12, urgency: Urgency.MEDIUM, prefix: 'BIN-KIDNEY', masterQrCode: 'TYPE-KIDNEY' } }),
        prisma.binType.create({ data: { organType: 'skin', dkHours: 24, urgency: Urgency.STANDARD, prefix: 'BIN-SKIN', masterQrCode: 'TYPE-SKIN' } }),
        prisma.binType.create({ data: { organType: 'fat', dkHours: 24, urgency: Urgency.STANDARD, prefix: 'BIN-FAT', masterQrCode: 'TYPE-FAT' } }),
        prisma.binType.create({ data: { organType: 'bone', dkHours: 48, urgency: Urgency.LOW, prefix: 'BIN-BONE', masterQrCode: 'TYPE-BONE' } }),
    ]);

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
                },
            }),
        ),
    );

    // ─── Done — print test guide ──────────────────────────────────
    console.log('\n✅ Seed complete!\n');
    console.log('═══════════════════════════════════════════════════════════');
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
