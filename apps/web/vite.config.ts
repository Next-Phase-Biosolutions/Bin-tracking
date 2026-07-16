import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const baseConfig = {
    plugins: [
        react(),
        tailwindcss(),
        nodePolyfills(), // Polyfill Node.js built-ins for MeshJS (e.g. process, Buffer, stream)
    ],
    envDir: '../../', // load .env from monorepo root
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    define: {
        global: 'globalThis',
    },
    server: {
        port: 3000,
        proxy: {
            '/trpc': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
};

export default defineConfig(({ mode }) => {
    // VITE_TEST_STATION_TOKEN is a local-dev kiosk convenience. It is a REAL
    // station credential, and anything in a VITE_ var ships in the public JS
    // bundle — setting it on a production build would hand every visitor
    // station-authenticated write access. Fail the build, don't warn.
    const env = loadEnv(mode, '../../', '');
    if (mode === 'production' && env['VITE_TEST_STATION_TOKEN']) {
        throw new Error(
            'VITE_TEST_STATION_TOKEN is set on a production build. It would embed a live ' +
                'station token in the public bundle — unset it (kiosks must use real per-device ' +
                'station provisioning in production).',
        );
    }
    return baseConfig;
});
