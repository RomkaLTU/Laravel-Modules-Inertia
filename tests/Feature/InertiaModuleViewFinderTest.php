<?php

use Illuminate\Filesystem\Filesystem;
use RomkaLTU\InertiaModules\InertiaModuleViewFinder;

beforeEach(function () {
    $this->tempDir = realpath(sys_get_temp_dir()).'/inertia-modules-test-'.uniqid();
    mkdir($this->tempDir, 0755, true);

    $this->modulesPath = $this->tempDir.'/Modules';
    mkdir($this->modulesPath, 0755, true);

    $this->appPagesPath = $this->tempDir.'/pages';
    mkdir($this->appPagesPath, 0755, true);
});

afterEach(function () {
    (new Filesystem)->deleteDirectory($this->tempDir);
});

function createFinder(string $modulesPath, array $paths, array $extensions = ['tsx', 'ts']): InertiaModuleViewFinder
{
    return new InertiaModuleViewFinder(
        new Filesystem,
        $paths,
        $extensions,
        $modulesPath,
    );
}

function createModulePage(string $modulesPath, string $module, string $page, string $extension = 'tsx'): string
{
    $dir = dirname("{$modulesPath}/{$module}/resources/views/{$page}.{$extension}");
    if (! is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $path = "{$modulesPath}/{$module}/resources/views/{$page}.{$extension}";
    file_put_contents($path, '');

    return $path;
}

it('resolves a module page when name contains a slash', function () {
    $expected = createModulePage($this->modulesPath, 'Fleet', 'trucks/index');
    $finder = createFinder($this->modulesPath, [$this->appPagesPath]);

    expect($finder->find('Fleet/trucks/index'))->toBe($expected);
});

it('returns the first matching extension', function () {
    createModulePage($this->modulesPath, 'Fleet', 'trucks/index', 'tsx');
    createModulePage($this->modulesPath, 'Fleet', 'trucks/index', 'ts');
    $finder = createFinder($this->modulesPath, [$this->appPagesPath]);

    $result = $finder->find('Fleet/trucks/index');

    expect($result)->toEndWith('.tsx');
});

it('resolves nested page paths within a module', function () {
    $expected = createModulePage($this->modulesPath, 'Fleet', 'trucks/partials/form');
    $finder = createFinder($this->modulesPath, [$this->appPagesPath]);

    expect($finder->find('Fleet/trucks/partials/form'))->toBe($expected);
});

it('falls back to parent when module file does not exist', function () {
    mkdir("{$this->modulesPath}/Fleet/resources/views", 0755, true);

    $appPage = "{$this->appPagesPath}/Fleet/trucks/index.tsx";
    mkdir(dirname($appPage), 0755, true);
    file_put_contents($appPage, '');

    $finder = createFinder($this->modulesPath, [$this->appPagesPath]);

    expect($finder->find('Fleet/trucks/index'))->toEndWith('/pages/Fleet/trucks/index.tsx');
});

it('delegates to parent when name has no slash', function () {
    $appPage = "{$this->appPagesPath}/Dashboard.tsx";
    file_put_contents($appPage, '');

    $finder = createFinder($this->modulesPath, [$this->appPagesPath]);

    expect($finder->find('Dashboard'))->toEndWith('/pages/Dashboard.tsx');
});

it('falls back to parent when module exists but page is missing', function () {
    createModulePage($this->modulesPath, 'Fleet', 'trucks/index');

    $appPage = "{$this->appPagesPath}/Fleet/other.tsx";
    mkdir(dirname($appPage), 0755, true);
    file_put_contents($appPage, '');

    $finder = createFinder($this->modulesPath, [$this->appPagesPath]);

    expect($finder->find('Fleet/other'))->toEndWith('/pages/Fleet/other.tsx');
});
