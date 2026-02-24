import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const USER_TOKEN = process.env.USER_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const API = 'http://localhost:3001/trpc';

function headers(auth) {
    return { Authorization: auth, 'Content-Type': 'application/json' };
}

async function tRPCGet(path, input, auth) {
    const url = `${API}/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
    const r = await fetch(url, { headers: headers(auth) });
    const d = await r.json();
    if (d.error) throw new Error(`${path}: ${d.error.json.message}`);
    return d.result.data.json;
}

async function tRPCPost(path, input, auth) {
    const r = await fetch(`${API}/${path}`, {
        method: 'POST',
        headers: headers(auth),
        body: JSON.stringify({ json: input }),
    });
    const d = await r.json();
    if (d.error) throw new Error(`${path}: ${d.error.json.message}`);
    return d.result.data.json;
}

async function main() {
    // Get station token from DB
    const adapter = new PrismaPg({ connectionString: DATABASE_URL });
    const prisma = new PrismaClient({ adapter, log: [] });
    const station = await prisma.station.findFirst({ where: { label: 'Chicago Tablet 1' } });
    await prisma.$disconnect();

    if (!station) throw new Error('No station found — did you run the seed?');
    const STATION_AUTH = `Token ${station.token}`;
    const USER_AUTH = `Bearer ${USER_TOKEN}`;

    console.log(`Station: ${station.label}\n`);

    console.log('STEP 1 — Scan bin QR code (station auth)');
    const bin = await tRPCGet('bin.getByQrCode', { qrCode: 'BIN-HEART-001' }, STATION_AUTH);
    console.log(`  ✓ ${bin.qrCode} | ${bin.status} | at ${bin.currentFacility.name}`);

    console.log('STEP 2 — Start cycle (station auth)');
    const cycle = await tRPCPost('bin.start', { qrCode: 'BIN-HEART-001' }, STATION_AUTH);
    console.log(`  ✓ Cycle: ${cycle.id} | ${cycle.status} | deadline: ${new Date(cycle.deadline).toISOString()}`);

    console.log('STEP 3 — Pickup (user auth)');
    const picked = await tRPCPost('cycle.pickup', { cycleId: cycle.id, vehicleId: 'TRUCK-42' }, USER_AUTH);
    console.log(`  ✓ ${picked.status} | pickedUpAt: ${picked.pickedUpAt}`);

    console.log('STEP 4 — Find rendering facility');
    const facs = await tRPCGet('facility.list', { type: 'RENDERING' }, USER_AUTH);
    const dest = facs.items.find(f => f.type === 'RENDERING');
    if (!dest) throw new Error('No RENDERING facility found');
    console.log(`  ✓ Destination: ${dest.name}`);

    console.log('STEP 5 — Deliver (user auth)');
    const delivered = await tRPCPost('cycle.deliver', { cycleId: cycle.id, destinationId: dest.id }, USER_AUTH);
    console.log(`  ✓ ${delivered.status} | compliance: ${delivered.complianceResult}`);

    console.log('STEP 6 — Bin history');
    const history = await tRPCGet('cycle.history', { binId: bin.id }, USER_AUTH);
    console.log(`  ✓ ${history.items.length} cycle(s) | latest: ${history.items[0]?.status}`);

    console.log('STEP 7 — Dashboard stats');
    const stats = await tRPCGet('dashboard.stats', {}, USER_AUTH);
    console.log(`  ✓ Active: ${stats.totalActiveBins} | Completed today: ${stats.totalCompletedToday} | Compliance: ${stats.complianceRate}%`);

    console.log('\n✅ All end-to-end tests passed!');
}

main().catch(e => {
    console.error('\n❌ Test failed:', e.message);
    process.exit(1);
});
