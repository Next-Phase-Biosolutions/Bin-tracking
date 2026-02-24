import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    envDir: '../../',   // load .env from monorepo root
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
