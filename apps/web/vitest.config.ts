import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests do NOT reuse vite.config.ts: its node-polyfills plugin injects browser shims into every
// module it transforms, including shared packages outside apps/web, where they cannot resolve.
// Component tests opt in to jsdom per file with `// @vitest-environment jsdom`; the default stays
// node, which is what the pure-logic tests want.
export default defineConfig({
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: { global: 'globalThis' },
    test: { include: ['src/**/*.test.{ts,tsx}'] },
});
