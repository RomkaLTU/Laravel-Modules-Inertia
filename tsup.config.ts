import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'js/index.ts',
        'vite-plugin': 'js/vite-plugin.ts',
        'resolve-page': 'js/resolve-page.ts',
    },
    format: ['esm'],
    tsconfig: 'tsconfig.build.json',
    dts: true,
    clean: true,
    outDir: 'dist',
    external: ['vite', 'laravel-vite-plugin', '@inertiajs/react'],
});
