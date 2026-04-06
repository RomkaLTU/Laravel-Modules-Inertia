# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com), and this project adheres to [Semantic Versioning](https://semver.org).

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
