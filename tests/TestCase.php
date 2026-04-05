<?php

namespace RomkaLTU\InertiaModules\Tests;

use Orchestra\Testbench\TestCase as BaseTestCase;
use RomkaLTU\InertiaModules\InertiaModulesServiceProvider;

abstract class TestCase extends BaseTestCase
{
    protected function getPackageProviders($app): array
    {
        return [
            InertiaModulesServiceProvider::class,
        ];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('inertia.pages.paths', [resource_path('js/pages')]);
        $app['config']->set('inertia.pages.extensions', ['tsx', 'ts']);
    }
}
