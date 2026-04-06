import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inertiaModules } from '../vite-plugin.js';

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReaddirSync = vi.mocked(readdirSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);

function getAliasPlugin(options = {}) {
    const plugins = inertiaModules(options);
    return plugins[0] as {
        name: string;
        config: (config: { root?: string }, env: { command: string }) => Record<string, unknown>;
        configResolved: (config: { root: string }) => void;
        buildStart: () => void;
    };
}

function getTailwindPlugin(options = {}) {
    const plugins = inertiaModules(options);
    return plugins[1] as {
        name: string;
        enforce: string;
        transform: (code: string, id: string) => { code: string; map: null } | null;
    };
}

function callConfig(options = {}) {
    return getAliasPlugin(options).config({ root: '/project' }, { command: 'build' });
}

function dirEntry(name: string) {
    return { name, isDirectory: () => true, isSymbolicLink: () => false } as ReturnType<
        typeof readdirSync<{ withFileTypes: true }>
    >[number];
}

function setupModules(modules: string[], opts: { withJs?: string[]; conflicts?: string[] } = {}) {
    const withJs = opts.withJs ?? modules;
    const conflictDirs = opts.conflicts ?? [];

    mockedExistsSync.mockImplementation((p) => {
        const path = String(p);
        if (path.endsWith('/Modules')) return true;
        if (path.endsWith('/resources/js')) {
            return withJs.some((m) => path.includes(`/${m}/`));
        }
        if (path.endsWith('/node_modules')) return conflictDirs.length > 0;
        if (path.endsWith('/package.json')) return false;
        if (path.endsWith('/tsconfig.json')) return false;
        return false;
    });
    mockedReaddirSync.mockImplementation((p) => {
        const path = String(p);
        if (path.endsWith('/Modules')) return modules.map(dirEntry) as never;
        if (path.endsWith('/node_modules')) return conflictDirs.map(dirEntry) as never;
        return [] as never;
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('inertiaModules', () => {
    it('returns an array of two plugins', () => {
        const plugins = inertiaModules();
        expect(plugins).toHaveLength(2);
        expect(plugins[0].name).toBe('laravel-modules-inertia');
        expect(plugins[1].name).toBe('laravel-modules-inertia:tailwind');
    });

    it('tailwind plugin has enforce pre', () => {
        const plugins = inertiaModules();
        expect(plugins[1]).toHaveProperty('enforce', 'pre');
    });
});

describe('alias plugin', () => {
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

describe('tsconfig sync', () => {
    function setupAndSync(
        tsConfigContent: string,
        modules: string[] = ['Fleet'],
        options: Record<string, unknown> = {},
    ) {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/tsconfig.json')) return true;
            if (path.endsWith('/package.json')) return false;
            if (path.endsWith('/node_modules')) return false;
            return false;
        });
        mockedReaddirSync.mockReturnValue(modules.map(dirEntry) as never);
        mockedReadFileSync.mockReturnValue(tsConfigContent);

        const plugin = getAliasPlugin(options);
        plugin.config({ root: '/project' }, { command: 'build' });
        plugin.configResolved({ root: '/project' });
        plugin.buildStart();
    }

    it('writes paths and includes to tsconfig.json', () => {
        const tsconfig = JSON.stringify(
            { compilerOptions: { paths: {} }, include: [] },
            null,
            4,
        );

        setupAndSync(tsconfig);

        expect(mockedWriteFileSync).toHaveBeenCalledOnce();
        const written = mockedWriteFileSync.mock.calls[0][1] as string;
        expect(written).toContain('"@modules/*"');
        expect(written).toContain('"@fleet/*"');
        expect(written).toContain('Modules/*/resources/views/**/*.ts');
        expect(written).toContain('Modules/*/resources/js/**/*.tsx');
    });

    it('preserves comments in tsconfig.json', () => {
        const tsconfig = `{
    // This is a comment
    "compilerOptions": {
        /* block comment */
        "paths": {}
    },
    "include": []
}`;

        setupAndSync(tsconfig);

        expect(mockedWriteFileSync).toHaveBeenCalledOnce();
        const written = mockedWriteFileSync.mock.calls[0][1] as string;
        expect(written).toContain('// This is a comment');
        expect(written).toContain('/* block comment */');
        expect(written).toContain('"@fleet/*"');
    });

    it('does not write when content is unchanged', () => {
        const tsconfig = JSON.stringify(
            {
                compilerOptions: {
                    paths: {
                        '@modules/*': ['./Modules/*'],
                        '@fleet/*': ['./Modules/Fleet/resources/js/*'],
                    },
                },
                include: [
                    'Modules/*/resources/views/**/*.ts',
                    'Modules/*/resources/views/**/*.tsx',
                    'Modules/*/resources/js/**/*.ts',
                    'Modules/*/resources/js/**/*.tsx',
                ],
            },
            null,
            4,
        );

        setupAndSync(tsconfig);

        expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it('creates compilerOptions.paths when missing', () => {
        const tsconfig = '{}';

        setupAndSync(tsconfig);

        expect(mockedWriteFileSync).toHaveBeenCalledOnce();
        const written = mockedWriteFileSync.mock.calls[0][1] as string;
        expect(written).toContain('"compilerOptions"');
        expect(written).toContain('"paths"');
        expect(written).toContain('"@fleet/*"');
    });

    it('skips when syncTsConfig is false', () => {
        setupAndSync('{}', ['Fleet'], { syncTsConfig: false });

        expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it('handles missing tsconfig.json gracefully', () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/tsconfig.json')) return false;
            return false;
        });
        mockedReaddirSync.mockReturnValue([dirEntry('Fleet')] as never);

        const plugin = getAliasPlugin();
        plugin.config({ root: '/project' }, { command: 'build' });
        plugin.configResolved({ root: '/project' });
        plugin.buildStart();

        expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it('handles write failure gracefully', () => {
        const tsconfig = JSON.stringify({ compilerOptions: {}, include: [] }, null, 4);

        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/tsconfig.json')) return true;
            if (path.endsWith('/package.json')) return false;
            if (path.endsWith('/node_modules')) return false;
            return false;
        });
        mockedReaddirSync.mockReturnValue([dirEntry('Fleet')] as never);
        mockedReadFileSync.mockReturnValue(tsconfig);
        mockedWriteFileSync.mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const plugin = getAliasPlugin();
        plugin.config({ root: '/project' }, { command: 'build' });
        plugin.configResolved({ root: '/project' });

        expect(() => plugin.buildStart()).not.toThrow();
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('Could not write tsconfig.json'),
        );
    });

    it('only syncs once across multiple buildStart calls', () => {
        const tsconfig = JSON.stringify({ compilerOptions: {}, include: [] }, null, 4);

        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.endsWith('/Modules')) return true;
            if (path.endsWith('/resources/js')) return true;
            if (path.endsWith('/tsconfig.json')) return true;
            if (path.endsWith('/package.json')) return false;
            if (path.endsWith('/node_modules')) return false;
            return false;
        });
        mockedReaddirSync.mockReturnValue([dirEntry('Fleet')] as never);
        mockedReadFileSync.mockReturnValue(tsconfig);

        const plugin = getAliasPlugin();
        plugin.config({ root: '/project' }, { command: 'build' });
        plugin.configResolved({ root: '/project' });
        plugin.buildStart();
        plugin.buildStart();

        expect(mockedWriteFileSync).toHaveBeenCalledOnce();
    });
});

describe('tailwind plugin', () => {
    function setupTailwindPlugins(modules: string[] = ['Fleet'], options: Record<string, unknown> = {}) {
        setupModules(modules);

        const plugins = inertiaModules(options);
        const alias = plugins[0] as {
            config: (config: { root?: string }, env: { command: string }) => Record<string, unknown>;
            configResolved: (config: { root: string }) => void;
        };
        const tailwind = plugins[1] as {
            transform: (code: string, id: string) => { code: string; map: null } | null;
        };

        alias.config({ root: '/project' }, { command: 'build' });
        alias.configResolved({ root: '/project' });

        return tailwind;
    }

    it('injects @source directives into CSS with tailwindcss import', () => {
        const tailwind = setupTailwindPlugins();
        const css = `@import 'tailwindcss';\n\n.foo { color: red; }`;
        const result = tailwind.transform(css, '/project/resources/css/app.css');

        expect(result).not.toBeNull();
        expect(result!.code).toContain("@source '../../Modules/*/resources/views';");
        expect(result!.code).toContain("@source '../../Modules/*/resources/js';");
        expect(result!.code).toContain("@import 'tailwindcss'");
    });

    it('handles double-quoted tailwindcss import', () => {
        const tailwind = setupTailwindPlugins();
        const css = `@import "tailwindcss";\n`;
        const result = tailwind.transform(css, '/project/resources/css/app.css');

        expect(result).not.toBeNull();
        expect(result!.code).toContain("@source '../../Modules/*/resources/views';");
    });

    it('handles tailwindcss sub-path imports', () => {
        const tailwind = setupTailwindPlugins();
        const css = `@import 'tailwindcss/theme';\n`;
        const result = tailwind.transform(css, '/project/resources/css/app.css');

        expect(result).not.toBeNull();
    });

    it('skips CSS files without tailwindcss import', () => {
        const tailwind = setupTailwindPlugins();
        const result = tailwind.transform('.foo { color: red; }', '/project/resources/css/app.css');

        expect(result).toBeNull();
    });

    it('skips non-CSS files', () => {
        const tailwind = setupTailwindPlugins();
        const result = tailwind.transform("@import 'tailwindcss';", '/project/app.tsx');

        expect(result).toBeNull();
    });

    it('does not inject when directives already present', () => {
        const tailwind = setupTailwindPlugins();
        const css = `@source '../../Modules/*/resources/views';\n@source '../../Modules/*/resources/js';\n@import 'tailwindcss';\n`;
        const result = tailwind.transform(css, '/project/resources/css/app.css');

        expect(result).toBeNull();
    });

    it('skips when syncTailwind is false', () => {
        const tailwind = setupTailwindPlugins(['Fleet'], { syncTailwind: false });
        const result = tailwind.transform("@import 'tailwindcss';", '/project/resources/css/app.css');

        expect(result).toBeNull();
    });
});
