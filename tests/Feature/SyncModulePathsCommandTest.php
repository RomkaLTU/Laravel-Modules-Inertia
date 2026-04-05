<?php

use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\Artisan;

beforeEach(function () {
    $this->tempDir = realpath(sys_get_temp_dir()).'/inertia-modules-sync-'.uniqid();
    mkdir($this->tempDir, 0755, true);

    $this->modulesPath = $this->tempDir.'/Modules';
    mkdir($this->modulesPath, 0755, true);

    config()->set('inertia-modules.modules_path', $this->modulesPath);
});

afterEach(function () {
    (new Filesystem)->deleteDirectory($this->tempDir);
});

function createModule(string $modulesPath, string $name, bool $withJs = true): void
{
    mkdir("{$modulesPath}/{$name}", 0755, true);
    if ($withJs) {
        mkdir("{$modulesPath}/{$name}/resources/js", 0755, true);
    }
}

it('fails when modules directory does not exist', function () {
    config()->set('inertia-modules.modules_path', '/nonexistent/path');

    $this->artisan('inertia-modules:sync')
        ->assertFailed();
});

it('generates tsconfig paths for modules with js directories', function () {
    createModule($this->modulesPath, 'Fleet');
    createModule($this->modulesPath, 'Auth');

    Artisan::call('inertia-modules:sync');
    $output = Artisan::output();

    expect($output)->toContain('@fleet/*');
    expect($output)->toContain('@auth/*');
});

it('skips modules without resources/js directory', function () {
    createModule($this->modulesPath, 'Fleet', withJs: true);
    createModule($this->modulesPath, 'Empty', withJs: false);

    Artisan::call('inertia-modules:sync');
    $output = Artisan::output();

    expect($output)->toContain('@fleet/*');
    expect($output)->not->toContain('@empty/*');
});

it('detects node_modules conflicts and appends suffix', function () {
    createModule($this->modulesPath, 'React');

    $nodeModulesPath = $this->tempDir.'/node_modules/react';
    mkdir($nodeModulesPath, 0755, true);

    app()->setBasePath($this->tempDir);

    Artisan::call('inertia-modules:sync');
    $output = Artisan::output();

    expect($output)->toContain('@react-module/*');
});

it('generates correct include patterns', function () {
    createModule($this->modulesPath, 'Fleet');

    Artisan::call('inertia-modules:sync');
    $output = Artisan::output();

    expect($output)
        ->toContain('Modules/*/resources/views/**/*.ts')
        ->toContain('Modules/*/resources/views/**/*.tsx')
        ->toContain('Modules/*/resources/js/**/*.ts')
        ->toContain('Modules/*/resources/js/**/*.tsx');
});

it('generates correct tailwind source directives', function () {
    createModule($this->modulesPath, 'Fleet');

    Artisan::call('inertia-modules:sync');
    $output = Artisan::output();

    expect($output)
        ->toContain("@source '../../Modules/*/resources/views'")
        ->toContain("@source '../../Modules/*/resources/js'");
});

it('writes merged paths and includes to tsconfig.json', function () {
    createModule($this->modulesPath, 'Fleet');

    app()->setBasePath($this->tempDir);

    $tsconfig = [
        'compilerOptions' => [
            'paths' => ['@/*' => ['./resources/js/*']],
        ],
        'include' => ['resources/js/**/*.ts'],
    ];
    file_put_contents(
        $this->tempDir.'/tsconfig.json',
        json_encode($tsconfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
    );

    Artisan::call('inertia-modules:sync', ['--write' => true]);

    $updated = json_decode(file_get_contents($this->tempDir.'/tsconfig.json'), true);

    expect($updated['compilerOptions']['paths'])->toHaveKey('@/*');
    expect($updated['compilerOptions']['paths'])->toHaveKey('@fleet/*');
    expect($updated['compilerOptions']['paths'])->toHaveKey('@modules/*');
    expect($updated['include'])->toContain('resources/js/**/*.ts');
    expect($updated['include'])->toContain('Modules/*/resources/views/**/*.tsx');
});

it('does not duplicate includes when writing twice', function () {
    createModule($this->modulesPath, 'Fleet');

    app()->setBasePath($this->tempDir);

    $tsconfig = ['compilerOptions' => [], 'include' => []];
    file_put_contents(
        $this->tempDir.'/tsconfig.json',
        json_encode($tsconfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
    );

    Artisan::call('inertia-modules:sync', ['--write' => true]);
    Artisan::call('inertia-modules:sync', ['--write' => true]);

    $updated = json_decode(file_get_contents($this->tempDir.'/tsconfig.json'), true);
    $counts = array_count_values($updated['include']);

    foreach ($counts as $pattern => $count) {
        expect($count)->toBe(1, "Include pattern '{$pattern}' is duplicated");
    }
});
