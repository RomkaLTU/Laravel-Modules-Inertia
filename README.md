# Laravel Modules Inertia

If you're using [nwidart/laravel-modules](https://laravelmodules.com) with [Inertia.js](https://inertiajs.com), you've probably run into the same problem we did: Inertia has no idea your modules exist. Page resolution breaks, Vite doesn't know where your module assets live, and you end up writing a bunch of glue code to make it all work.

This package fixes that. It gives you automatic page resolution for module views and a Vite plugin that sets up import aliases, syncs your `tsconfig.json`, and injects Tailwind source paths — all automatically.

## Requirements

- PHP 8.2+
- Laravel 11, 12, or 13
- [nwidart/laravel-modules](https://github.com/nWidart/laravel-modules) v11+
- [inertiajs/inertia-laravel](https://github.com/inertiajs/inertia-laravel) v2+
- Vite 6 or 7

## Installation

```bash
composer require romkaltu/laravel-modules-inertia
```

Then add the package to your `package.json` dependencies so your frontend tooling can import from it:

```json
{
    "devDependencies": {
        "laravel-modules-inertia": "file:vendor/romkaltu/laravel-modules-inertia"
    }
}
```

Run `npm install` (or `pnpm install`) to symlink it into `node_modules/`. After that, imports like `'laravel-modules-inertia/vite'` just work.

The service provider is auto-discovered, so you don't need to register it manually.

### Publish the config (optional)

```bash
php artisan vendor:publish --tag=inertia-modules-config
```

This publishes `config/inertia-modules.php` where you can customize the modules path. By default, it reads from your `laravel-modules` config or falls back to `base_path('Modules')`.

## How It Works

### The Problem

With a standard Inertia setup, when you call `Inertia::render('trucks/index')`, Laravel looks for pages in `resources/js/pages/`. But in a modular app, you want your Fleet module's pages to live in `Modules/Fleet/resources/views/`, not mixed into the main app.

### The Solution

This package hooks into Inertia's view finder so that page names like `Fleet/trucks/index` automatically resolve to `Modules/Fleet/resources/views/trucks/index.tsx`. The first segment before the slash is treated as the module name, and the rest is the page path within that module.

If no matching file is found in the module, it falls back to the default Inertia page resolution — so your existing app pages keep working as before.

## Setup

### 1. Vite Plugin

Add the Vite plugin to your `vite.config.ts`. Place `inertiaModules()` **before** `tailwindcss()` in the plugins array so that Tailwind `@source` directives are injected automatically:

```ts
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { inertiaModules } from 'laravel-modules-inertia/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            refresh: true,
        }),
        inertiaModules(),
        tailwindcss(),
    ],
});
```

The plugin does three things automatically:

1. **Vite aliases** — Scans your `Modules/` directory and creates aliases for each module with a `resources/js/` folder (`@fleet`, `@auth`, etc.)
2. **TypeScript config** — Syncs `tsconfig.json` with module paths and includes on every `vite dev` / `vite build` start, preserving existing comments and formatting
3. **Tailwind sources** — Injects `@source` directives into CSS files that import `tailwindcss`, so Tailwind scans your module templates for classes

After the plugin runs, you can import from modules like this:

```ts
import { TruckForm } from '@fleet/components/TruckForm';
```

#### Conflict Detection

If a module name conflicts with an npm package (e.g., you have a module called `React`), the plugin automatically appends `-module` to the alias (`@react-module`) and warns you about it. You can also set explicit aliases:

```ts
inertiaModules({
    aliases: {
        Fleet: '@my-fleet',
    },
});
```

#### Plugin Options

| Option | Default | Description |
|--------|---------|-------------|
| `modulesDir` | `'Modules'` | Path to modules directory, relative to project root |
| `prefix` | `'@'` | Prefix for auto-generated aliases |
| `conflictSuffix` | `'-module'` | Suffix appended when an alias conflicts with an npm package |
| `conflicts` | auto-detected | Module names (lowercase) that should get the conflict suffix |
| `aliases` | `{}` | Explicit alias overrides, e.g. `{ Fleet: '@my-fleet' }` |
| `syncTsConfig` | `true` | Auto-update `tsconfig.json` with module paths and includes |
| `syncTailwind` | `true` | Auto-inject `@source` directives into Tailwind CSS files |
| `tsConfigPath` | `'tsconfig.json'` | Path to tsconfig.json, relative to project root |

### 2. Page Resolver

Set up the Inertia page resolver to handle module pages. You can either use the publishable stub or wire it up manually.

#### Using the stub

```bash
php artisan vendor:publish --tag=inertia-modules-stubs
```

This creates `resources/js/inertia/config.tsx` with a ready-to-use setup.

#### Manual setup

```ts
import { createPageResolver } from 'laravel-modules-inertia/resolve-page';
import type { ResolvedComponent } from '@inertiajs/react';

const applicationPages = import.meta.glob<ResolvedComponent>('../pages/**/*.tsx');
const modulePages = import.meta.glob<ResolvedComponent>('../../../Modules/*/resources/views/**/*.tsx');

export const resolveInertiaPage = createPageResolver({
    applicationPages,
    modulePages,
});
```

Then use it in your `app.tsx`:

```tsx
import { resolveInertiaPage } from './inertia/config';

createInertiaApp({
    resolve: resolveInertiaPage,
    // ...
});
```

#### Resolver Options

| Option | Default | Description |
|--------|---------|-------------|
| `applicationPages` | required | Glob result for app pages (`resources/js/pages/`) |
| `modulePages` | required | Glob result for module pages (`Modules/*/resources/views/`) |
| `modulePagePrefix` | `'../../../Modules/'` | Prefix in glob keys for module pages |
| `appPagePrefix` | `'../pages/'` | Prefix in glob keys for app pages |
| `extension` | `'.tsx'` | File extension for pages |

### 3. Diagnostic Command (Optional)

The Vite plugin handles TypeScript and Tailwind configuration automatically (see step 1). If you need to inspect what the plugin would generate, or prefer to manage your config manually, an artisan command is available:

```bash
php artisan inertia-modules:sync
```

This outputs the TypeScript paths, includes, and Tailwind `@source` directives for your current modules. To patch `tsconfig.json` directly from the PHP side:

```bash
php artisan inertia-modules:sync --write
```

This is useful in environments where Vite isn't available (e.g., CI pipelines that only run PHP). For day-to-day development, the Vite plugin handles everything.

## Expected Module Structure

The package expects each module to follow this layout:

```
Modules/
  Fleet/
    resources/
      views/          ← Inertia pages (resolved by the page resolver)
        trucks/
          index.tsx
          show.tsx
      js/             ← Shared JS/TS code (aliased by the Vite plugin)
        components/
          TruckForm.tsx
        hooks/
          useTrucks.ts
```

- **`resources/views/`** — Inertia page components. These are what you pass to `Inertia::render('Fleet/trucks/index')`.
- **`resources/js/`** — Shared module code (components, hooks, utilities). Accessible via the `@fleet` alias in imports.

## Usage in Controllers

Once set up, rendering module pages from controllers works exactly like you'd expect:

```php
// In Modules/Fleet/Http/Controllers/TruckController.php

use Inertia\Inertia;

class TruckController extends Controller
{
    public function index()
    {
        return Inertia::render('Fleet/trucks/index', [
            'trucks' => Truck::all(),
        ]);
    }
}
```

Pages without a module prefix (e.g., `Inertia::render('Dashboard')`) continue to resolve from the standard `resources/js/pages/` directory.

## Other Frameworks

This initial release ships with first-class React support. Vue and Svelte adapters are on the roadmap — the page resolver is framework-agnostic under the hood, so adding support for other Inertia adapters is mostly a matter of providing the right stubs and documenting the glob patterns. Stay tuned.

## Configuration

### `config/inertia-modules.php`

```php
return [
    /*
     * The absolute path to the modules directory.
     * When null, it's resolved from nwidart/laravel-modules config
     * (config('modules.paths.modules')), falling back to base_path('Modules').
     */
    'modules_path' => null,
];
```

## Testing

```bash
# PHP tests
composer test

# JavaScript tests
npm test

# Static analysis
composer analyse

# Code formatting
composer format
```

## License

MIT. See [LICENSE](LICENSE) for details.
