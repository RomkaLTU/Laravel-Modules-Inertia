import { describe, it, expect, vi } from 'vitest';
import { createPageResolver } from '../resolve-page.js';

function mockGlob(pages: Record<string, unknown>) {
    const result: Record<string, () => Promise<unknown>> = {};
    for (const [key, value] of Object.entries(pages)) {
        result[key] = vi.fn().mockResolvedValue(value);
    }
    return result;
}

describe('createPageResolver', () => {
    it('resolves a module page when name contains a slash', async () => {
        const component = { default: 'FleetTrucksIndex' };
        const modulePages = mockGlob({
            '../../../Modules/Fleet/resources/views/trucks/index.tsx': component,
        });

        const resolve = createPageResolver({
            applicationPages: {},
            modulePages,
        });

        const result = await resolve('Fleet/trucks/index');
        expect(result).toBe(component);
        expect(modulePages['../../../Modules/Fleet/resources/views/trucks/index.tsx']).toHaveBeenCalledOnce();
    });

    it('resolves an application page when name has no slash', async () => {
        const component = { default: 'Dashboard' };
        const applicationPages = mockGlob({
            '../pages/Dashboard.tsx': component,
        });

        const resolve = createPageResolver({
            applicationPages,
            modulePages: {},
        });

        const result = await resolve('Dashboard');
        expect(result).toBe(component);
    });

    it('throws with available pages list when page not found', async () => {
        const applicationPages = mockGlob({
            '../pages/Home.tsx': { default: 'Home' },
            '../pages/About.tsx': { default: 'About' },
        });

        const resolve = createPageResolver({
            applicationPages,
            modulePages: {},
        });

        await expect(resolve('Missing')).rejects.toThrow('Page not found');
        await expect(resolve('Missing')).rejects.toThrow('../pages/Home.tsx');
    });

    it('falls back to application pages when module page not found', async () => {
        const component = { default: 'Fallback' };
        const applicationPages = mockGlob({
            '../pages/Fleet/unknown.tsx': component,
        });

        const resolve = createPageResolver({
            applicationPages,
            modulePages: {},
        });

        const result = await resolve('Fleet/unknown');
        expect(result).toBe(component);
    });

    it('respects custom prefix and extension options', async () => {
        const component = { default: 'Custom' };
        const modulePages = mockGlob({
            '../../modules/Fleet/resources/views/index.vue': component,
        });

        const resolve = createPageResolver({
            applicationPages: {},
            modulePages,
            modulePagePrefix: '../../modules/',
            appPagePrefix: './pages/',
            extension: '.vue',
        });

        const result = await resolve('Fleet/index');
        expect(result).toBe(component);
    });
});
