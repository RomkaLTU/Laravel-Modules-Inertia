# Contributing

Thanks for considering contributing! Here's how to get started.

## Setup

```bash
# Clone the repo
git clone https://github.com/RomkaLTU/laravel-modules-inertia.git
cd laravel-modules-inertia

# Install PHP dependencies
composer install

# Install JS dependencies (for development/testing only)
pnpm install
```

## Running Tests

```bash
# PHP tests
composer test

# JS tests
pnpm test

# Static analysis
composer analyse

# Code formatting check
composer format:test

# Run everything
composer check
```

## Code Style

PHP code is formatted with [Laravel Pint](https://laravel.com/docs/pint). Run `composer format` before committing — CI will fail if formatting is off.

TypeScript has no formatter configured yet, just keep it consistent with the existing code.

## Building the JS

The compiled `dist/` directory is committed to the repo (since the package is distributed via Packagist, not npm). If you change any TypeScript files, rebuild before committing:

```bash
pnpm build
```

## Pull Requests

- Keep PRs focused on a single change
- Add tests for new functionality
- If you changed TypeScript, run `pnpm build` and commit the updated `dist/`
- Make sure all checks pass before requesting review
- Write a clear description of what changed and why

## Bug Reports

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (PHP version, Laravel version, Node version)
