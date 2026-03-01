import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

async function main() {
    try {
        console.log("Fetching stations...");
        const stations = await prisma.station.findMany();
        console.log(stations);

        console.log("\nFetching users...");
        const users = await prisma.user.findMany();
        console.log(users.map(u => ({ email: u.email, id: u.id, role: u.role })));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
