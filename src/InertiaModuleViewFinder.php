<?php

namespace RomkaLTU\InertiaModules;

use Illuminate\Filesystem\Filesystem;
use Illuminate\View\FileViewFinder;

class InertiaModuleViewFinder extends FileViewFinder
{
    /**
     * @param  array<int, string>  $paths
     * @param  array<int, string>|null  $extensions
     */
    public function __construct(
        Filesystem $filesystem,
        array $paths,
        ?array $extensions = null,
        private readonly string $modulesPath = '',
    ) {
        parent::__construct($filesystem, $paths, $extensions);
    }

    /**
     * Get the fully qualified location of the view.
     *
     * Supports module-prefixed Inertia component names (e.g. "Fleet/trucks/index")
     * by checking the module's resources/views directory before falling back to
     * the default paths.
     */
    public function find($name): string
    {
        if (str_contains($name, '/')) {
            $segments = explode('/', $name, 2);
            $modulePath = $this->modulesPath."/{$segments[0]}/resources/views/{$segments[1]}";

            foreach ($this->extensions as $extension) {
                if ($this->files->exists("{$modulePath}.{$extension}")) {
                    return "{$modulePath}.{$extension}";
                }
            }
        }

        return parent::find($name);
    }
}
