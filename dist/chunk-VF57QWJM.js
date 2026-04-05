// js/resolve-page.ts
function createPageResolver(options) {
  const {
    applicationPages,
    modulePages,
    modulePagePrefix = "../../../Modules/",
    appPagePrefix = "../pages/",
    extension = ".tsx"
  } = options;
  return async function resolveInertiaPage(name) {
    if (name.includes("/")) {
      const slashIndex = name.indexOf("/");
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
        `Page not found: ${pagePath}. Available pages: ${Object.keys(applicationPages).join(", ")}`
      );
    }
    return page();
  };
}

export {
  createPageResolver
};
