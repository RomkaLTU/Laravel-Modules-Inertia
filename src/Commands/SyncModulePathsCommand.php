<?php

namespace RomkaLTU\InertiaModules\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;

class SyncModulePathsCommand extends Command
{
    protected $signature = 'inertia-modules:sync {--write : Patch tsconfig.json directly}';

    protected $description = 'Generate TypeScript and Tailwind configuration for module frontend assets';

    public function handle(Filesystem $files): int
    {
        $modulesPath = config('inertia-modules.modules_path')
            ?? config('modules.paths.modules', base_path('Modules'));

        if (! $files->isDirectory($modulesPath)) {
            $this->error("Modules directory not found: {$modulesPath}");

            return self::FAILURE;
        }

        $modulesDir = basename($modulesPath);
        $nodeModulesPath = base_path('node_modules');

        $modules = collect($files->directories($modulesPath))
            ->map(fn (string $path): string => basename($path))
            ->sort()
            ->values();

        $modulesWithJs = $modules->filter(
            fn (string $name): bool => $files->isDirectory("{$modulesPath}/{$name}/resources/js"),
        );

        $conflictingNames = $modulesWithJs
            ->map(fn (string $name): string => strtolower($name))
            ->filter(fn (string $name): bool => $files->isDirectory("{$nodeModulesPath}/@{$name}")
                || $files->isDirectory("{$nodeModulesPath}/{$name}"),
            )
            ->all();

        // Generate tsconfig paths
        $paths = [
            '@modules/*' => ["./{$modulesDir}/*"],
        ];

        foreach ($modulesWithJs as $name) {
            $lowerName = strtolower($name);
            $aliasName = in_array($lowerName, $conflictingNames, true)
                ? "@{$lowerName}-module"
                : "@{$lowerName}";

            $paths["{$aliasName}/*"] = ["./{$modulesDir}/{$name}/resources/js/*"];
        }

        // Generate tsconfig include entries
        $includes = [
            "{$modulesDir}/*/resources/views/**/*.ts",
            "{$modulesDir}/*/resources/views/**/*.tsx",
            "{$modulesDir}/*/resources/js/**/*.ts",
            "{$modulesDir}/*/resources/js/**/*.tsx",
        ];

        // Generate Tailwind @source directives (relative from resources/css/)
        $sources = [
            "@source '../../{$modulesDir}/*/resources/views';",
            "@source '../../{$modulesDir}/*/resources/js';",
        ];

        $this->components->info('TypeScript paths (tsconfig.json → compilerOptions.paths):');
        $this->line((string) json_encode($paths, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        $this->newLine();
        $this->components->info('TypeScript includes (tsconfig.json → include):');
        $this->line((string) json_encode($includes, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        $this->newLine();
        $this->components->info('Tailwind sources (add to resources/css/app.css):');

        foreach ($sources as $source) {
            $this->line($source);
        }

        if ($this->option('write')) {
            $this->writeTsConfig($files, $paths, $includes);
        }

        return self::SUCCESS;
    }

    /**
     * @param  array<string, array<int, string>>  $paths
     * @param  array<int, string>  $includes
     */
    private function writeTsConfig(Filesystem $files, array $paths, array $includes): void
    {
        $tsconfigPath = base_path('tsconfig.json');

        if (! $files->exists($tsconfigPath)) {
            $this->error('tsconfig.json not found at project root.');

            return;
        }

        $raw = $files->get($tsconfigPath);
        $tsconfig = json_decode($this->stripJsonComments($raw), true);

        if (! is_array($tsconfig)) {
            $this->error('Failed to parse tsconfig.json.');

            return;
        }

        // Merge paths
        $existingPaths = $tsconfig['compilerOptions']['paths'] ?? [];

        foreach ($paths as $alias => $target) {
            $existingPaths[$alias] = $target;
        }

        $tsconfig['compilerOptions']['paths'] = $existingPaths;

        // Merge includes
        $existingIncludes = $tsconfig['include'] ?? [];

        foreach ($includes as $include) {
            if (! in_array($include, $existingIncludes, true)) {
                $existingIncludes[] = $include;
            }
        }

        $tsconfig['include'] = $existingIncludes;

        $files->put(
            $tsconfigPath,
            json_encode($tsconfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n",
        );

        $this->components->info('Updated tsconfig.json with module paths and includes.');
    }

    /**
     * Strip comments and trailing commas from a JSONC string so it can
     * be decoded with json_decode. This handles single-line (//) and
     * multi-line comments, and trailing commas before } or ].
     */
    private function stripJsonComments(string $json): string
    {
        $result = '';
        $length = strlen($json);
        $inString = false;
        $i = 0;

        while ($i < $length) {
            $char = $json[$i];

            // Handle string literals (skip content inside strings)
            if ($inString) {
                $result .= $char;
                if ($char === '\\') {
                    $i++;
                    if ($i < $length) {
                        $result .= $json[$i];
                    }
                } elseif ($char === '"') {
                    $inString = false;
                }
                $i++;

                continue;
            }

            // Start of string
            if ($char === '"') {
                $inString = true;
                $result .= $char;
                $i++;

                continue;
            }

            // Single-line comment
            if ($char === '/' && $i + 1 < $length && $json[$i + 1] === '/') {
                // Skip to end of line
                while ($i < $length && $json[$i] !== "\n") {
                    $i++;
                }

                continue;
            }

            // Multi-line comment
            if ($char === '/' && $i + 1 < $length && $json[$i + 1] === '*') {
                $i += 2;
                while ($i + 1 < $length && ! ($json[$i] === '*' && $json[$i + 1] === '/')) {
                    $i++;
                }
                $i += 2; // skip */

                continue;
            }

            $result .= $char;
            $i++;
        }

        // Remove trailing commas before ] or }
        $result = (string) preg_replace('/,\s*([\]}])/s', '$1', $result);

        return $result;
    }
}
