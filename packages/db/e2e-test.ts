/**
 * End-to-end API test
 *
 * Tests the complete bin lifecycle:
 *   Scan QR → Start Cycle → Pickup → Deliver → Check Dashboard
 *
 * Run: pnpm --filter @bin-tracker/db e2e
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const API = 'http://localhost:3001/trpc';
const SUPABASE_URL = process.env['SUPABASE_URL']!;
const ANON_KEY = process.env['SUPABASE_ANON_KEY']!;
const DATABASE_URL = process.env['DATABASE_URL']!;

// ─── tRPC HTTP helpers ─────────────────────────────────────────────────────

function makeHeaders(auth: string) {
    return { Authorization: auth, 'Content-Type': 'application/json' };
}

async function trpcGet<T = unknown>(path: string, input: unknown, auth: string): Promise<T> {
    const url = `${API}/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
    const res = await fetch(url, { headers: makeHeaders(auth) });
    const body = await res.json() as Record<string, unknown>;
    if ((body as { error?: unknown }).error) {
        const errMsg = ((body as { error: { json: { message: string } } }).error.json).message;
        throw new Error(`${path}: ${errMsg}`);
    }
    return ((body as { result: { data: { json: T } } }).result.data.json);
}

async function trpcPost<T = unknown>(path: string, input: unknown, auth: string): Promise<T> {
    const res = await fetch(`${API}/${path}`, {
        method: 'POST',
        headers: makeHeaders(auth),
        body: JSON.stringify({ json: input }),
    });
    const body = await res.json() as Record<string, unknown>;
    if ((body as { error?: unknown }).error) {
        const errMsg = ((body as { error: { json: { message: string } } }).error.json).message;
        throw new Error(`${path}: ${errMsg}`);
    }
    return ((body as { result: { data: { json: T } } }).result.data.json);
}

// ─── Supabase Auth login ───────────────────────────────────────────────────

async function login(email: string, password: string): Promise<string> {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as { access_token?: string; error_description?: string };
    if (!data.access_token) {
        throw new Error(`Login failed for ${email}: ${data.error_description ?? 'Unknown error'}`);
    }
    return data.access_token;
}

// ─── Main ──────────────────────────────────────────────────────────────────

interface Facility { id: string; name: string; type: string }
interface FacilityList { items: Facility[]; totalCount: number }
interface Bin { id: string; qrCode: string; status: string; currentFacility: { name: string } }
interface Cycle { id: string; status: string; deadline: string; complianceResult?: string; pickedUpAt?: string }
interface CycleHistory { items: Cycle[]; totalCount: number }
interface DashStats { totalActiveBins: number; totalCompletedToday: number; complianceRate: number; totalOverdue: number }

let passed = 0;
let failed = 0;

function ok(label: string, detail: string) {
    passed++;
    console.log(`  ✅ ${label}: ${detail}`);
}

function fail(label: string, err: unknown) {
    failed++;
    console.log(`  ❌ ${label}: ${err instanceof Error ? err.message : String(err)}`);
}

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║       BIN TRACKER — END-TO-END TESTS        ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // ─── Step 0: Get station token from DB ──────────────────
    console.log('SETUP — Fetch station token from DB');
    const adapter = new PrismaPg({ connectionString: DATABASE_URL });
    const prisma = new PrismaClient({ adapter, log: [] });
    const station = await prisma.station.findFirst({ where: { label: 'Chicago Tablet 1' } });
    await prisma.$disconnect();
    if (!station) throw new Error('No station found — run seed first');
    const STATION_AUTH = `Station ${station.token}`;
    ok('Station loaded', station.label);

    // ─── Step 1: Login as admin ─────────────────────────────
    console.log('\nSTEP 1 — Login as admin');
    const adminToken = await login('admin@bintracker.com', 'Admin1234!');
    const ADMIN_AUTH = `Bearer ${adminToken}`;
    ok('Admin JWT', `${adminToken.substring(0, 30)}...`);

    // ─── Step 2: Login as driver1 ───────────────────────────
    console.log('\nSTEP 2 — Login as driver1');
    const driverToken = await login('driver1@bintracker.com', 'Driver1234!');
    const DRIVER_AUTH = `Bearer ${driverToken}`;
    ok('Driver1 JWT', `${driverToken.substring(0, 30)}...`);

    // ─── Step 3: facility.list (admin sees all 5) ───────────
    console.log('\nSTEP 3 — facility.list (admin)');
    try {
        const facs = await trpcGet<FacilityList>('facility.list', {}, ADMIN_AUTH);
        ok('Facilities', `${facs.items.length} returned`);
        if (facs.items.length !== 5) fail('Count check', `Expected 5, got ${facs.items.length}`);
    } catch (e) { fail('facility.list', e); }

    // ─── Step 4: bin.list (admin sees all 20) ───────────────
    console.log('\nSTEP 4 — bin.list (admin)');
    try {
        const bins = await trpcGet<{ items: Bin[]; totalCount: number }>('bin.list', { limit: 100 }, ADMIN_AUTH);
        ok('Bins', `${bins.totalCount} total (returned ${bins.items.length})`);
    } catch (e) { fail('bin.list', e); }

    // ─── Step 5: bin.getByQrCode ────────────────────────────
    console.log('\nSTEP 5 — bin.getByQrCode (admin)');
    let binId: string | undefined;
    try {
        const bin = await trpcGet<Bin>('bin.getByQrCode', { qrCode: 'BIN-HEART-001' }, ADMIN_AUTH);
        binId = bin.id;
        ok('Scanned bin', `${bin.qrCode} | status: ${bin.status} | at: ${bin.currentFacility.name}`);
    } catch (e) { fail('bin.getByQrCode', e); }

    // ─── Step 6: bin.start (station auth) ───────────────────
    console.log('\nSTEP 6 — bin.start (station auth)');
    let cycleId: string | undefined;
    try {
        const cycle = await trpcPost<Cycle>('bin.start', { qrCode: 'BIN-HEART-001' }, STATION_AUTH);
        cycleId = cycle.id;
        ok('Cycle started', `id: ${cycle.id} | status: ${cycle.status} | deadline: ${cycle.deadline}`);
    } catch (e) { fail('bin.start', e); }

    if (!cycleId) {
        console.log('\n⚠️  Cannot continue without a cycle — skipping remaining steps');
        printSummary();
        return;
    }

    // ─── Step 7: cycle.pickup (driver auth) ─────────────────
    console.log('\nSTEP 7 — cycle.pickup (driver1 auth)');
    try {
        const picked = await trpcPost<Cycle>('cycle.pickup', { cycleId, vehicleId: 'TRUCK-42' }, DRIVER_AUTH);
        ok('Picked up', `status: ${picked.status} | pickedUpAt: ${picked.pickedUpAt}`);
    } catch (e) { fail('cycle.pickup', e); }

    // ─── Step 8: Find rendering facility (admin) and deliver (driver) ──
    console.log('\nSTEP 8 — cycle.deliver (driver1 auth)');
    try {
        // Use admin to find rendering facilities (driver1 isn't assigned to rendering facilities)
        const facs = await trpcGet<FacilityList>('facility.list', { type: 'RENDERING' }, ADMIN_AUTH);
        const dest = facs.items.find((f: Facility) => f.type === 'RENDERING');
        if (!dest) throw new Error('No RENDERING facility found');

        // Driver delivers (cycle.deliver only checks driver assignment, not dest facility access)
        const delivered = await trpcPost<Cycle>('cycle.deliver', {
            cycleId,
            destinationId: dest.id,
        }, DRIVER_AUTH);
        ok('Delivered', `status: ${delivered.status} | compliance: ${delivered.complianceResult}`);
    } catch (e) { fail('cycle.deliver', e); }

    // ─── Step 9: cycle.history ──────────────────────────────
    console.log('\nSTEP 9 — cycle.history');
    if (binId) {
        try {
            const history = await trpcGet<CycleHistory>('cycle.history', { binId }, ADMIN_AUTH);
            ok('History', `${history.items.length} cycle(s) | latest: ${history.items[0]?.status}`);
        } catch (e) { fail('cycle.history', e); }
    }

    // ─── Step 10: dashboard.stats ───────────────────────────
    console.log('\nSTEP 10 — dashboard.stats');
    try {
        const stats = await trpcGet<DashStats>('dashboard.stats', {}, ADMIN_AUTH);
        ok('Stats', `active: ${stats.totalActiveBins} | completed today: ${stats.totalCompletedToday} | compliance: ${stats.complianceRate}%`);
    } catch (e) { fail('dashboard.stats', e); }

    // ─── Step 11: Auth guard test (no token) ────────────────
    console.log('\nSTEP 11 — Auth guard (no token → 401)');
    try {
        await trpcGet('facility.list', {}, '');
        fail('Auth guard', 'Should have thrown UNAUTHORIZED');
    } catch (e) {
        if (e instanceof Error && e.message.includes('Authentication required')) {
            ok('Auth guard', 'Correctly returned UNAUTHORIZED');
        } else {
            fail('Auth guard', e);
        }
    }

    printSummary();
}

function printSummary() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log(`║  Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 24 - String(passed).length - String(failed).length))}║`);
    console.log('╚══════════════════════════════════════════════╝');
    if (failed > 0) process.exit(1);
}

main().catch(e => {
    console.error('\n💥 Fatal error:', e.message);
    process.exit(1);
});
