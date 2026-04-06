import { Plugin } from 'vite';

interface InertiaModulesOptions {
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
declare function inertiaModules(options?: InertiaModulesOptions): Plugin[];

export { type InertiaModulesOptions, inertiaModules };
