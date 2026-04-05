import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface VitePlugin {
    name: string;
    config?: (config: { root?: string }, env: { command: string }) => Record<string, unknown> | void;
}

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
}

export function inertiaModules(options: InertiaModulesOptions = {}): VitePlugin {
    const {
        modulesDir = 'Modules',
        conflictSuffix = '-module',
        conflicts,
        aliases = {},
        prefix = '@',
    } = options;

    return {
        name: 'laravel-modules-inertia',
        config(config) {
            const root = config.root || process.cwd();
            const modulesPath = resolve(root, modulesDir);

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

            for (const mod of modules) {
                const jsPath = join(modulesPath, mod.name, 'resources', 'js');

                if (!existsSync(jsPath)) {
                    continue;
                }

                if (aliases[mod.name]) {
                    const alias = aliases[mod.name];

                    if (knownPackages && isAliasConflicting(alias, knownPackages)) {
                        warnings.push(
                            `Explicit alias "${alias}" for module "${mod.name}" conflicts with a package in node_modules. ` +
                                `This may shadow imports starting with "${alias}".`,
                        );
                    }

                    resolvedAliases[alias] = jsPath;
                } else {
                    const lowerName = mod.name.toLowerCase();

                    if (conflictSet.has(lowerName)) {
                        const aliasName = `${prefix}${lowerName}${conflictSuffix}`;
                        warnings.push(
                            `Module "${mod.name}" conflicts with a package in node_modules. ` +
                                `Alias auto-renamed to "${aliasName}". ` +
                                `Use the "aliases" option to set a custom name.`,
                        );
                        resolvedAliases[aliasName] = jsPath;
                    } else {
                        resolvedAliases[`${prefix}${lowerName}`] = jsPath;
                    }
                }
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
    };
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
