<?php

use RomkaLTU\InertiaModules\InertiaModuleViewFinder;

it('binds InertiaModuleViewFinder to the container', function () {
    expect(app('inertia.view-finder'))->toBeInstanceOf(InertiaModuleViewFinder::class);
});

it('uses inertia-modules.modules_path config', function () {
    config()->set('inertia-modules.modules_path', '/custom/path');

    $finder = app()->make('inertia.view-finder');
    $reflection = new ReflectionProperty($finder, 'modulesPath');

    expect($reflection->getValue($finder))->toBe('/custom/path');
});

it('falls back to modules.paths.modules config', function () {
    config()->set('inertia-modules.modules_path', null);
    config()->set('modules.paths.modules', '/nwidart/modules');

    $finder = app()->make('inertia.view-finder');
    $reflection = new ReflectionProperty($finder, 'modulesPath');

    expect($reflection->getValue($finder))->toBe('/nwidart/modules');
});

it('falls back to base_path Modules when no config is set', function () {
    config()->set('inertia-modules.modules_path', null);

    $finder = app()->make('inertia.view-finder');
    $reflection = new ReflectionProperty($finder, 'modulesPath');

    expect($reflection->getValue($finder))->toBe(base_path('Modules'));
});

it('registers the sync command when running in console', function () {
    $this->artisan('list')
        ->assertSuccessful();

    expect(array_key_exists('inertia-modules:sync', Artisan::all()))->toBeTrue();
});
