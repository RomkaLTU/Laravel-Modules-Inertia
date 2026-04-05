type PageGlobs<T = unknown> = Record<string, () => Promise<T>>;
interface CreatePageResolverOptions<T = unknown> {
    /** Glob result for application pages (resources/js/pages/) */
    applicationPages: PageGlobs<T>;
    /** Glob result for module pages (Modules/{Name}/resources/views/) */
    modulePages: PageGlobs<T>;
    /** Relative path prefix for module pages in the glob keys. Default: '../../../Modules/' */
    modulePagePrefix?: string;
    /** Relative path prefix for application pages in the glob keys. Default: '../pages/' */
    appPagePrefix?: string;
    /** File extension for pages. Default: '.tsx' */
    extension?: string;
}
/**
 * Creates an Inertia page resolver that supports module-prefixed page names.
 *
 * Pages with a slash in the name (e.g. "Fleet/trucks/index") are resolved
 * from the module's resources/views directory. Pages without a module prefix
 * fall back to the application pages directory.
 */
declare function createPageResolver<T = unknown>(options: CreatePageResolverOptions<T>): (name: string) => Promise<T>;

export { type CreatePageResolverOptions, type PageGlobs, createPageResolver };
