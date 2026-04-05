interface VitePlugin {
    name: string;
    config?: (config: {
        root?: string;
    }, env: {
        command: string;
    }) => Record<string, unknown> | void;
}
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
}
declare function inertiaModules(options?: InertiaModulesOptions): VitePlugin;

export { type InertiaModulesOptions, inertiaModules };
