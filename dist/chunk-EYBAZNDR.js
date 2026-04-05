// js/vite-plugin.ts
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
function inertiaModules(options = {}) {
  const {
    modulesDir = "Modules",
    conflictSuffix = "-module",
    conflicts,
    aliases = {},
    prefix = "@"
  } = options;
  return {
    name: "laravel-modules-inertia",
    config(config) {
      const root = config.root || process.cwd();
      const modulesPath = resolve(root, modulesDir);
      if (!existsSync(modulesPath)) {
        return {};
      }
      const modules = readdirSync(modulesPath, { withFileTypes: true }).filter((d) => d.isDirectory());
      const moduleNames = modules.map((m) => m.name);
      const knownPackages = conflicts ? null : collectKnownPackages(root);
      const conflictSet = new Set(conflicts ?? detectConflicts(moduleNames, prefix, knownPackages));
      const warnings = [];
      const resolvedAliases = {
        [`${prefix}modules`]: modulesPath
      };
      for (const mod of modules) {
        const jsPath = join(modulesPath, mod.name, "resources", "js");
        if (!existsSync(jsPath)) {
          continue;
        }
        if (aliases[mod.name]) {
          const alias = aliases[mod.name];
          if (knownPackages && isAliasConflicting(alias, knownPackages)) {
            warnings.push(
              `Explicit alias "${alias}" for module "${mod.name}" conflicts with a package in node_modules. This may shadow imports starting with "${alias}".`
            );
          }
          resolvedAliases[alias] = jsPath;
        } else {
          const lowerName = mod.name.toLowerCase();
          if (conflictSet.has(lowerName)) {
            const aliasName = `${prefix}${lowerName}${conflictSuffix}`;
            warnings.push(
              `Module "${mod.name}" conflicts with a package in node_modules. Alias auto-renamed to "${aliasName}". Use the "aliases" option to set a custom name.`
            );
            resolvedAliases[aliasName] = jsPath;
          } else {
            resolvedAliases[`${prefix}${lowerName}`] = jsPath;
          }
        }
      }
      for (const warning of warnings) {
        console.warn(`\x1B[33m[laravel-modules-inertia]\x1B[0m ${warning}`);
      }
      return {
        resolve: {
          alias: resolvedAliases
        }
      };
    }
  };
}
function collectKnownPackages(root) {
  const nodeModulesPath = resolve(root, "node_modules");
  const packageJsonPath = resolve(root, "package.json");
  const known = /* @__PURE__ */ new Set();
  if (existsSync(nodeModulesPath)) {
    try {
      for (const entry of readdirSync(nodeModulesPath, { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        if (entry.name.startsWith(".")) continue;
        known.add(entry.name.toLowerCase());
      }
    } catch {
    }
  }
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
      for (const dep of Object.keys(allDeps)) {
        if (dep.startsWith("@")) {
          known.add(dep.split("/")[0].toLowerCase());
        } else {
          known.add(dep.toLowerCase());
        }
      }
    } catch {
    }
  }
  return known;
}
function detectConflicts(moduleNames, prefix, knownPackages) {
  return moduleNames.map((n) => n.toLowerCase()).filter((name) => knownPackages.has(`${prefix}${name}`) || knownPackages.has(name));
}
function isAliasConflicting(alias, knownPackages) {
  const lower = alias.toLowerCase();
  return knownPackages.has(lower) || knownPackages.has(lower.replace(/^@/, ""));
}

export {
  inertiaModules
};
