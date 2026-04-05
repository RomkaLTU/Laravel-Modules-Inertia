import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inertiaModules } from '../vite-plugin.js';

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
}));

import { existsSync, readdirSync, readFileSync } from 'node:fs';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReaddirSync = vi.mocked(readdirSync);
const mockedReadFileSync = vi.mocked(readFileSync);

function callConfig(options = {}) {
    const plugin = inertiaModules(options) as {
        config: (config: { root?: string }, env: { command: string }) => Record<string, unknown>;
    };
    return plugin.config({ root: '/project' }, { command: 'build' });
}

function dirEntry(name: string) {
    return { name, isDirectory: () => true, isSymbolicLink: () => false } as ReturnType<
        typeof readdirSync<{ withFileTypes: true }>
    >[number];
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('inertiaModules', () => {
    it('returns empty object when modules directory does not exist', () => {
        mockedExistsSync.mockReturnValue(false);

        const result = callConfig();
        expect(result).toEqual({});
    });

    it('generates lowercase aliases for modules with resources/js', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/package.json')) return false;
            if (path.endsWith('/node_modules')) return false;
            return false;
        });
        mockedReaddirSync.mockReturnValue([dirEntry('Fleet'), dirEntry('Auth')] as never);

        const result = callConfig() as { resolve: { alias: Record<string, string> } };

        expect(result.resolve.alias['@fleet']).toBe('/project/Modules/Fleet/resources/js');
        expect(result.resolve.alias['@auth']).toBe('/project/Modules/Auth/resources/js');
    });

    it('skips modules without resources/js directory', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.includes('Fleet') && path.endsWith('/resources/js')) return true;
            if (path.includes('Empty') && path.endsWith('/resources/js')) return false;
            return false;
        });
        mockedReaddirSync.mockReturnValue([dirEntry('Fleet'), dirEntry('Empty')] as never);

        const result = callConfig() as { resolve: { alias: Record<string, string> } };

        expect(result.resolve.alias['@fleet']).toBeDefined();
        expect(result.resolve.alias['@empty']).toBeUndefined();
    });

    it('always includes @modules alias pointing to modules root', () => {
        mockedExistsSync.mockImplementation((p) => String(p).endsWith('/Modules'));
        mockedReaddirSync.mockReturnValue([] as never);

        const result = callConfig() as { resolve: { alias: Record<string, string> } };

        expect(result.resolve.alias['@modules']).toBe('/project/Modules');
    });

    it('auto-detects conflicts from node_modules directories', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/node_modules')) return true;
            if (path.endsWith('/package.json')) return false;
            return false;
        });
        mockedReaddirSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return [dirEntry('React')] as never;
            if (path.endsWith('/node_modules')) return [dirEntry('react')] as never;
            return [] as never;
        });

        const result = callConfig() as { resolve: { alias: Record<string, string> } };

        expect(result.resolve.alias['@react-module']).toBeDefined();
        expect(result.resolve.alias['@react']).toBeUndefined();
    });

    it('auto-detects conflicts from package.json dependencies', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/node_modules')) return false;
            if (path.endsWith('/package.json')) return true;
            return false;
        });
        mockedReaddirSync.mockReturnValue([dirEntry('Axios')] as never);
        mockedReadFileSync.mockReturnValue(
            JSON.stringify({ dependencies: { axios: '^1.0' } }),
        );

        const result = callConfig() as { resolve: { alias: Record<string, string> } };

        expect(result.resolve.alias['@axios-module']).toBeDefined();
        expect(result.resolve.alias['@axios']).toBeUndefined();
    });

    it('detects scoped package conflicts from package.json', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/node_modules')) return false;
            if (path.endsWith('/package.json')) return true;
            return false;
        });
        mockedReaddirSync.mockReturnValue([dirEntry('Tanstack')] as never);
        mockedReadFileSync.mockReturnValue(
            JSON.stringify({ dependencies: { '@tanstack/react-query': '^5.0' } }),
        );

        const result = callConfig() as { resolve: { alias: Record<string, string> } };

        expect(result.resolve.alias['@tanstack-module']).toBeDefined();
        expect(result.resolve.alias['@tanstack']).toBeUndefined();
    });

    it('uses explicit alias overrides from options', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            return false;
        });
        mockedReaddirSync.mockReturnValue([dirEntry('Fleet')] as never);

        const result = callConfig({ aliases: { Fleet: '@my-fleet' } }) as {
            resolve: { alias: Record<string, string> };
        };

        expect(result.resolve.alias['@my-fleet']).toBe('/project/Modules/Fleet/resources/js');
        expect(result.resolve.alias['@fleet']).toBeUndefined();
    });

    it('warns when explicit alias conflicts with a known package', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/node_modules')) return true;
            if (path.endsWith('/package.json')) return false;
            return false;
        });
        mockedReaddirSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return [dirEntry('Fleet')] as never;
            if (path.endsWith('/node_modules')) return [dirEntry('react')] as never;
            return [] as never;
        });

        callConfig({ aliases: { Fleet: 'react' } });

        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('Explicit alias "react" for module "Fleet"'),
        );
    });

    it('respects custom prefix and conflict suffix options', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/node_modules')) return true;
            if (path.endsWith('/package.json')) return false;
            return false;
        });
        mockedReaddirSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return [dirEntry('Fleet'), dirEntry('React')] as never;
            if (path.endsWith('/node_modules')) return [dirEntry('~react')] as never;
            return [] as never;
        });

        const result = callConfig({ prefix: '~', conflictSuffix: '-mod' }) as {
            resolve: { alias: Record<string, string> };
        };

        expect(result.resolve.alias['~fleet']).toBeDefined();
        expect(result.resolve.alias['~react-mod']).toBeDefined();
    });
});
