/**
 * pin-logo.mjs  — upload the logo to Pinata IPFS (no external deps, Node 22+)
 *
 * Usage:
 *   PINATA_JWT=<your_jwt> node scripts/pin-logo.mjs
 *
 * Then paste the output line into your .env:
 *   CARDANO_NFT_IMAGE_CID=ipfs://baf...
 *
 * Get a free Pinata JWT at https://app.pinata.cloud/keys
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, '../apps/web/public/assets/imgLogo.png');
const JWT = process.env.PINATA_JWT;

if (!JWT) {
    console.error('Error: PINATA_JWT is not set.');
    console.error('Get a free key at https://app.pinata.cloud/keys, then run:');
    console.error('  PINATA_JWT=<your_jwt> node scripts/pin-logo.mjs');
    process.exit(1);
}

console.log('Uploading logo to IPFS via Pinata...');

const logoBytes = readFileSync(LOGO_PATH);
const blob = new Blob([logoBytes], { type: 'image/png' });

const form = new FormData();
form.append('file', blob, 'imgLogo.png');
form.append('pinataMetadata', JSON.stringify({ name: 'Bin Tracker Logo' }));
form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${JWT}` },
    body: form,
});

if (!res.ok) {
    const body = await res.text();
    console.error('Upload failed:', res.status, body);
    process.exit(1);
}

const { IpfsHash } = await res.json();
console.log('\n✓ Upload successful!\n');
console.log('Paste this into your .env:');
console.log(`CARDANO_NFT_IMAGE_CID=ipfs://${IpfsHash}`);
console.log('\nView on IPFS gateway:');
console.log(`https://gateway.pinata.cloud/ipfs/${IpfsHash}`);
