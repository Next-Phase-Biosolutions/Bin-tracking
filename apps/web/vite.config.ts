import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
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
    return {
        ...baseConfig,
        // Production serves this app's build from /app/* under the same
        // domain as apps/marketing (see root netlify.toml) — asset URLs
        // need the matching prefix. Local dev still runs standalone at the
        // root of its own port, so this only applies to `vite build`.
        base: mode === 'production' ? '/app/' : '/',
    };
});
