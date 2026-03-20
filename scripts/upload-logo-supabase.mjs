/**
 * upload-logo-supabase.mjs — upload the NFT logo to Supabase Storage
 *
 * Usage:
 *   node scripts/upload-logo-supabase.mjs
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env
 * Then sets CARDANO_NFT_IMAGE_CID in .env automatically.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGO_PATH = join(ROOT, 'apps/web/public/assets/imgLogo.png');
const ENV_PATH = join(ROOT, '.env');

// ── Load .env ────────────────────────────────────────────────────────────────
function loadEnv(path) {
    const raw = readFileSync(path, 'utf8');
    const vars = {};
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        vars[key] = val;
    }
    return vars;
}

// ── Update a single key in .env ──────────────────────────────────────────────
function updateEnv(path, key, value) {
    const raw = readFileSync(path, 'utf8');
    const pattern = new RegExp(`^(${key}=).*$`, 'm');
    if (pattern.test(raw)) {
        writeFileSync(path, raw.replace(pattern, `$1"${value}"`));
    } else {
        writeFileSync(path, raw + `\n${key}="${value}"\n`);
    }
}

const env = loadEnv(ENV_PATH);
const SUPABASE_URL = env['SUPABASE_URL'];
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env');
    process.exit(1);
}

const BUCKET = 'nft-assets';
const FILE_NAME = 'imgLogo.png';
const headers = {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
};

// ── 1. Ensure bucket exists ──────────────────────────────────────────────────
console.log(`Ensuring storage bucket "${BUCKET}" exists...`);

const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
});

if (!bucketRes.ok) {
    const body = await bucketRes.json().catch(() => ({}));
    // 409 = already exists, that's fine
    if (bucketRes.status !== 409 && body?.error !== 'Duplicate') {
        console.error('Failed to create bucket:', bucketRes.status, body);
        process.exit(1);
    }
    console.log(`Bucket "${BUCKET}" already exists.`);
} else {
    console.log(`Bucket "${BUCKET}" created.`);
}

// ── 2. Upload the logo ───────────────────────────────────────────────────────
console.log('Uploading logo...');

const logoBytes = readFileSync(LOGO_PATH);

const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE_NAME}`,
    {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'image/png',
            'x-upsert': 'true',   // overwrite if already exists
        },
        body: logoBytes,
    }
);

if (!uploadRes.ok) {
    const body = await uploadRes.text();
    console.error('Upload failed:', uploadRes.status, body);
    process.exit(1);
}

// ── 3. Build the public URL ──────────────────────────────────────────────────
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${FILE_NAME}`;
console.log('\n✓ Upload successful!\n');
console.log('Public URL:', publicUrl);

// ── 4. Write it into .env automatically ─────────────────────────────────────
updateEnv(ENV_PATH, 'CARDANO_NFT_IMAGE_CID', publicUrl);
console.log(`\n✓ Updated .env: CARDANO_NFT_IMAGE_CID="${publicUrl}"`);
console.log('\nRestart your API server for the change to take effect.');
