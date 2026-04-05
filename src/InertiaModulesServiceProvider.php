<?php

namespace RomkaLTU\InertiaModules;

use Illuminate\Support\ServiceProvider;

class InertiaModulesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/inertia-modules.php', 'inertia-modules');

        $this->app->bind('inertia.view-finder', function ($app) {
            $modulesPath = $app['config']->get('inertia-modules.modules_path')
                ?? $app['config']->get('modules.paths.modules', base_path('Modules'));

            return new InertiaModuleViewFinder(
                $app['files'],
                $app['config']->get('inertia.pages.paths'),
                $app['config']->get('inertia.pages.extensions'),
                $modulesPath,
            );
        });
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__.'/../config/inertia-modules.php' => config_path('inertia-modules.php'),
        ], 'inertia-modules-config');

        $this->publishes([
            __DIR__.'/../stubs/inertia-config.tsx.stub' => resource_path('js/inertia/config.tsx'),
        ], 'inertia-modules-stubs');

        if ($this->app->runningInConsole()) {
            $this->commands([
                Commands\SyncModulePathsCommand::class,
            ]);
        }
    }
}
