import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
    // Reset stuck BIN-HEART-001 so the E2E test can start a fresh cycle
    const cancelled = await prisma.binCycle.updateMany({
        where: { bin: { qrCode: 'BIN-HEART-001' }, status: { in: ['ACTIVE', 'IN_TRANSIT'] } },
        data: { status: 'COMPLETED' }
    });
    await prisma.bin.updateMany({ where: { qrCode: 'BIN-HEART-001' }, data: { status: 'IDLE' } });
    console.log(`Reset: ${cancelled.count} cycle(s) cancelled, bin set back to IDLE`);
}

main().finally(() => prisma.$disconnect());
