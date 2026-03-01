import { prisma } from './src/index.js';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The output directory for the 5 generic master QR codes
const OUT_DIR = path.join(__dirname, '../../apps/web/public/qr/master');

// Configuration for generating the generic master QRs
const GENERATION_CONFIG = [
    { organType: 'Heart', masterQrCode: 'TYPE-HEART' },
    { organType: 'Liver', masterQrCode: 'TYPE-LIVER' },
    { organType: 'Kidney', masterQrCode: 'TYPE-KIDNEY' },
    { organType: 'Skin', masterQrCode: 'TYPE-SKIN' },
    { organType: 'Fat', masterQrCode: 'TYPE-FAT' },
];

async function main() {
    console.log('🔄 Starting Master QR Code Generation...');

    // 1. Ensure output directory exists
    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
        console.log(`📁 Created directory: ${OUT_DIR}`);
    }

    // 2. Process each organ type
    for (const config of GENERATION_CONFIG) {
        console.log(`\n🩺 Processing Master QR for ${config.organType}...`);

        // Find or create the BinType and assign the masterQrCode
        let binType = await prisma.binType.findUnique({
            where: { organType: config.organType.toLowerCase() } // Normalizing to lowercase to match existing seed if possible
        });

        // If it doesn't exist by lowercase, try exact case
        if (!binType) {
            binType = await prisma.binType.findUnique({
                where: { organType: config.organType }
            });
        }

        if (binType) {
            console.log(`✅ Found BinType ${binType.organType}. Updating masterQrCode...`);
            await prisma.binType.update({
                where: { id: binType.id },
                data: { masterQrCode: config.masterQrCode }
            });
        } else {
            console.log(`⚠️ BinType ${config.organType} not found in DB! Skipping generation.`);
            continue;
        }

        // Generate Physical Master QR Code Image
        const fileName = `${config.organType}_MASTER.png`;
        const filePath = path.join(OUT_DIR, fileName);

        await QRCode.toFile(filePath, config.masterQrCode, {
            color: {
                dark: '#043F2E',  // Dark green from brand guidelines
                light: '#FFFFFF'
            },
            width: 500,
            margin: 2
        });

        console.log(`🖼️ Saved Master Image to ${filePath}`);
    }

    console.log('\n🎉 Finished! The 5 Master QR codes have been seeded and saved to:', OUT_DIR);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
