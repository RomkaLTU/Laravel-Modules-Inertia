import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { modify, applyEdits, parse as parseJsonc, type ModificationOptions } from 'jsonc-parser';
import type { Plugin } from 'vite';

export interface InertiaModulesOptions {
    /** Path to the modules directory, relative to project root. Default: 'Modules' */
    modulesDir?: string;

    /** Suffix appended to alias names that conflict with node_modules packages. Default: '-module' */
    conflictSuffix?: string;

    /** Module names (lowercase) that should get the conflict suffix. Default: auto-detected from node_modules + package.json */
    conflicts?: string[];

    /** Explicit alias overrides: e.g. { 'Fleet': '@my-fleet' } */
    aliases?: Record<string, string>;

    /** Prefix for auto-generated aliases. Default: '@' */
    prefix?: string;

    /** Auto-update tsconfig.json with module paths and includes on dev/build start. Default: true */
    syncTsConfig?: boolean;

    /** Auto-inject Tailwind @source directives into CSS files that import tailwindcss. Default: true */
    syncTailwind?: boolean;

    /** Path to tsconfig.json, relative to project root. Default: 'tsconfig.json' */
    tsConfigPath?: string;
}

interface ModuleInfo {
    name: string;
    alias: string;
    jsPath: string;
}

export function inertiaModules(options: InertiaModulesOptions = {}): Plugin[] {
    const {
        modulesDir = 'Modules',
        conflictSuffix = '-module',
        conflicts,
        aliases = {},
        prefix = '@',
        syncTsConfig = true,
        syncTailwind = true,
        tsConfigPath = 'tsconfig.json',
    } = options;

    let resolvedRoot = '';
    let modulesPath = '';
    let resolvedModules: ModuleInfo[] = [];
    let hasSynced = false;

    const aliasPlugin: Plugin = {
        name: 'laravel-modules-inertia',
        config(config) {
            const root = config.root || process.cwd();
            modulesPath = resolve(root, modulesDir);

            if (!existsSync(modulesPath)) {
                return {};
            }

            const modules = readdirSync(modulesPath, { withFileTypes: true }).filter((d) => d.isDirectory());
            const moduleNames = modules.map((m) => m.name);
            const knownPackages = conflicts ? null : collectKnownPackages(root);
            const conflictSet = new Set(conflicts ?? detectConflicts(moduleNames, prefix, knownPackages!));
            const warnings: string[] = [];

            const resolvedAliases: Record<string, string> = {
                [`${prefix}modules`]: modulesPath,
            };

            resolvedModules = [];

            for (const mod of modules) {
                const jsPath = join(modulesPath, mod.name, 'resources', 'js');

                if (!existsSync(jsPath)) {
                    continue;
                }

                let alias: string;

                if (aliases[mod.name]) {
                    alias = aliases[mod.name];

                    if (knownPackages && isAliasConflicting(alias, knownPackages)) {
                        warnings.push(
                            `Explicit alias "${alias}" for module "${mod.name}" conflicts with a package in node_modules. ` +
                                `This may shadow imports starting with "${alias}".`,
                        );
                    }
                } else {
                    const lowerName = mod.name.toLowerCase();

                    if (conflictSet.has(lowerName)) {
                        alias = `${prefix}${lowerName}${conflictSuffix}`;
                        warnings.push(
                            `Module "${mod.name}" conflicts with a package in node_modules. ` +
                                `Alias auto-renamed to "${alias}". ` +
                                `Use the "aliases" option to set a custom name.`,
                        );
                    } else {
                        alias = `${prefix}${lowerName}`;
                    }
                }

                resolvedAliases[alias] = jsPath;
                resolvedModules.push({ name: mod.name, alias, jsPath });
            }

            for (const warning of warnings) {
                console.warn(`\x1b[33m[laravel-modules-inertia]\x1b[0m ${warning}`);
            }

            return {
                resolve: {
                    alias: resolvedAliases,
                },
            };
        },
        configResolved(config) {
            resolvedRoot = config.root;
        },
        buildStart() {
            if (!syncTsConfig || hasSynced) return;
            hasSynced = true;

            if (!resolvedRoot || !existsSync(resolve(resolvedRoot, modulesDir))) return;

            syncTsConfigFile(resolvedRoot, modulesDir, resolvedModules, tsConfigPath);
        },
    };

    const tailwindPlugin: Plugin = {
        name: 'laravel-modules-inertia:tailwind',
        enforce: 'pre',
        transform(code, id) {
            if (!syncTailwind) return null;
            if (!id.endsWith('.css')) return null;
            if (!/@import\s+['"]tailwindcss/.test(code)) return null;
            if (!resolvedRoot || !existsSync(resolve(resolvedRoot, modulesDir))) return null;

            const cssDir = dirname(id);
            const relPath = relative(cssDir, resolve(resolvedRoot, modulesDir));

            const sources = [
                `@source '${relPath}/*/resources/views';`,
                `@source '${relPath}/*/resources/js';`,
            ];

            const newDirectives = sources.filter((s) => !code.includes(s));

            if (newDirectives.length === 0) return null;

            return {
                code: newDirectives.join('\n') + '\n' + code,
                map: null,
            };
        },
    };

    return [aliasPlugin, tailwindPlugin];
}

function syncTsConfigFile(
    root: string,
    modulesDir: string,
    modules: ModuleInfo[],
    tsConfigPath: string,
): void {
    const fullPath = resolve(root, tsConfigPath);

    if (!existsSync(fullPath)) return;

    let text: string;
    try {
        text = readFileSync(fullPath, 'utf-8');
    } catch {
        return;
    }

    const original = text;
    const formatOptions: ModificationOptions['formattingOptions'] = {
        tabSize: 4,
        insertSpaces: true,
    };

    // Sync compilerOptions.paths
    const paths: Record<string, string[]> = {
        [`@modules/*`]: [`./${modulesDir}/*`],
    };

    for (const mod of modules) {
        paths[`${mod.alias}/*`] = [`./${modulesDir}/${mod.name}/resources/js/*`];
    }

    for (const [key, value] of Object.entries(paths)) {
        const edits = modify(text, ['compilerOptions', 'paths', key], value, { formattingOptions: formatOptions });
        text = applyEdits(text, edits);
    }

    // Sync include entries
    const includes = [
        `${modulesDir}/*/resources/views/**/*.ts`,
        `${modulesDir}/*/resources/views/**/*.tsx`,
        `${modulesDir}/*/resources/js/**/*.ts`,
        `${modulesDir}/*/resources/js/**/*.tsx`,
    ];

    for (const include of includes) {
        // Check if already present by parsing current includes
        const currentIncludes = parseCurrentIncludes(text);
        if (!currentIncludes.includes(include)) {
            const edits = modify(text, ['include', -1], include, {
                formattingOptions: formatOptions,
                isArrayInsertion: true,
            });
            text = applyEdits(text, edits);
        }
    }

    if (text !== original) {
        try {
            writeFileSync(fullPath, text, 'utf-8');
            console.info('\x1b[36m[laravel-modules-inertia]\x1b[0m Synced tsconfig.json with module paths.');
        } catch {
            console.warn(
                '\x1b[33m[laravel-modules-inertia]\x1b[0m Could not write tsconfig.json. Run with --write manually.',
            );
        }
    }
}

function parseCurrentIncludes(text: string): string[] {
    try {
        const parsed = parseJsonc(text);
        return Array.isArray(parsed?.include) ? parsed.include : [];
    } catch {
        return [];
    }
}

/**
 * Collects all known package names and scoped package prefixes from
 * both node_modules (installed) and package.json (declared).
 */
function collectKnownPackages(root: string): Set<string> {
    const nodeModulesPath = resolve(root, 'node_modules');
    const packageJsonPath = resolve(root, 'package.json');
    const known = new Set<string>();

    if (existsSync(nodeModulesPath)) {
        try {
            for (const entry of readdirSync(nodeModulesPath, { withFileTypes: true })) {
                if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
                if (entry.name.startsWith('.')) continue;
                known.add(entry.name.toLowerCase());
            }
        } catch {
            // node_modules not readable
        }
    }

    if (existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };

            for (const dep of Object.keys(allDeps)) {
                if (dep.startsWith('@')) {
                    // @tanstack/react-query → @tanstack
                    known.add(dep.split('/')[0].toLowerCase());
                } else {
                    known.add(dep.toLowerCase());
                }
            }
        } catch {
            // package.json not readable or invalid
        }
    }

    return known;
}

/**
 * Returns module names (lowercase) whose auto-generated alias would
 * collide with a known package or scoped package prefix.
 */
function detectConflicts(moduleNames: string[], prefix: string, knownPackages: Set<string>): string[] {
    return moduleNames
        .map((n) => n.toLowerCase())
        .filter((name) => knownPackages.has(`${prefix}${name}`) || knownPackages.has(name));
}

/**
 * Checks whether an explicit alias string conflicts with a known package.
 */
function isAliasConflicting(alias: string, knownPackages: Set<string>): boolean {
    const lower = alias.toLowerCase();
    return knownPackages.has(lower) || knownPackages.has(lower.replace(/^@/, ''));
}
