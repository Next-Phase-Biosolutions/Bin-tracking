import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        nodePolyfills() // Polyfill Node.js built-ins for MeshJS (e.g. process, Buffer, stream)
    ],
    envDir: '../../',   // load .env from monorepo root
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
});
