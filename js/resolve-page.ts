export type PageGlobs<T = unknown> = Record<string, () => Promise<T>>;

export interface CreatePageResolverOptions<T = unknown> {
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
export function createPageResolver<T = unknown>(options: CreatePageResolverOptions<T>) {
    const {
        applicationPages,
        modulePages,
        modulePagePrefix = '../../../Modules/',
        appPagePrefix = '../pages/',
        extension = '.tsx',
    } = options;

    return async function resolveInertiaPage(name: string): Promise<T> {
        if (name.includes('/')) {
            const slashIndex = name.indexOf('/');
            const moduleName = name.substring(0, slashIndex);
            const pageName = name.substring(slashIndex + 1);
            const expectedPath = `${modulePagePrefix}${moduleName}/resources/views/${pageName}${extension}`;

            if (modulePages[expectedPath]) {
                return modulePages[expectedPath]();
            }
        }

        const pagePath = `${appPagePrefix}${name}${extension}`;
        const page = applicationPages[pagePath];

        if (!page) {
            throw new Error(
                `Page not found: ${pagePath}. Available pages: ${Object.keys(applicationPages).join(', ')}`,
            );
        }

        return page();
    };
}
