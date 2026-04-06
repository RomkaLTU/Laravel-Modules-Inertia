# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com), and this project adheres to [Semantic Versioning](https://semver.org).

## [0.2.1] - 2026-04-06

### Fixed

- Remove `ziggy-js` dependency from publishable stub — Ziggy is project-specific and should not be assumed

## [0.2.0] - 2026-04-06

### Added

- Automatic `tsconfig.json` syncing via Vite plugin — module paths and includes are merged on every `vite dev` / `vite build` start, preserving comments and formatting (uses `jsonc-parser`)
- Automatic Tailwind `@source` directive injection — CSS files importing `tailwindcss` receive module source paths automatically
- New plugin options: `syncTsConfig`, `syncTailwind`, `tsConfigPath`

### Changed

- `inertiaModules()` now returns `Plugin[]` (array of two Vite plugins) instead of a single plugin
- Step 3 ("Sync TypeScript & Tailwind Config") is no longer a required installation step

### Fixed

- `inertia-modules:sync --write` failing with "Failed to parse tsconfig.json" on files containing comments or trailing commas (JSONC format)

## [0.1.1] - 2026-04-06

### Changed

- Update GitHub Actions to Node.js 24-compatible versions (checkout v6, setup-node v6, pnpm/action-setup v5)

### Added

- Automated GitHub Release creation on tag push via release workflow

## [0.1.0] - 2026-04-06

### Added

- Inertia page resolution for nwidart/laravel-modules — render module pages with `Inertia::render('ModuleName/page')`
- Vite plugin with automatic import aliases for module JS directories (`@modulename`)
- Conflict detection for module aliases that clash with npm packages
- `inertia-modules:sync` artisan command for generating TypeScript paths, includes, and Tailwind source directives
- `--write` flag to patch `tsconfig.json` directly
- Publishable config and starter stub for React + Inertia setup
