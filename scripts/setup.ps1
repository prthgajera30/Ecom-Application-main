Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step($Message) {
    Write-Host "`n==> $Message"
}

function Run-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter()][string[]]$Arguments = @(),
        [switch]$AllowFailure,
        [string]$ErrorHint
    )

    $display = "$Command $($Arguments -join ' ')".Trim()
    Write-Host "--> Running: $display"
    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        if ($AllowFailure) {
            if ($ErrorHint) {
                Write-Warning $ErrorHint
            }
            Write-Warning "Command '$display' exited with code $exitCode."
            return $exitCode
        }

        if ($ErrorHint) {
            Write-Error $ErrorHint
        }
        Write-Error "Command '$display' exited with code $exitCode."
        exit $exitCode
    }

    return 0
}

$ScriptsRoot = $PSScriptRoot
$NodeDispatcher = Join-Path $ScriptsRoot 'run-script.mjs'

Write-Step "Ensuring Corepack is enabled"
if (Get-Command corepack -ErrorAction SilentlyContinue) {
    [void](Run-Command 'corepack' @('enable') -AllowFailure)
} else {
    Write-Error "Corepack is not available. Install Node.js 20 or newer."
    exit 1
}

Write-Step "Checking toolchain versions"
$nodeVersion = node --version
Write-Host "Node $nodeVersion"
$normalizedNodeVersion = $nodeVersion.TrimStart('v')
if ([version]$normalizedNodeVersion -lt [version]'20.0.0') {
    Write-Error "Node.js 20 or newer is required. Current: $nodeVersion"
    exit 1
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Run-Command 'corepack' @('prepare', 'pnpm@9.12.3', '--activate')
}
$pnpmVersion = (& pnpm --version)
Write-Host "pnpm $pnpmVersion"

Write-Step "Installing workspace dependencies"
Run-Command 'pnpm' @('install', '--recursive', '--ignore-scripts')

Write-Step "Creating environment files if missing"
if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host '  - Created .env from .env.example'
}
if (-not (Test-Path 'apps/api/.env')) {
    Copy-Item 'apps/api/.env.example' 'apps/api/.env'
    Write-Host '  - Created apps/api/.env from template'
}
if (-not (Test-Path 'apps/web/.env')) {
    Copy-Item 'apps/web/.env.example' 'apps/web/.env'
    Write-Host '  - Created apps/web/.env from template'
}

if (-not (Test-Path '.first-run-done') -and (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Step "Resetting Docker database volumes for a clean first run"
    [void](Run-Command 'docker' @('compose', 'down', '--volumes', '--remove-orphans') -AllowFailure)
}

Write-Step "Starting PostgreSQL and MongoDB containers"
$shouldWait = $true
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $result = Run-Command 'docker' @('compose', 'up', '-d', 'db', 'mongo') -AllowFailure -ErrorHint 'Docker Compose failed to start the containers. Ensure Docker Desktop is running or manage Postgres/Mongo manually.'
    if ($result -eq 0) {
        Write-Step "Waiting for PostgreSQL to become ready"
        Run-Command 'node' @($NodeDispatcher, 'db-wait') -ErrorHint 'Postgres did not become healthy. Inspect the container logs or start your local database manually before continuing.'
    } else {
        $shouldWait = $false
    }
} else {
    Write-Warning "Docker is not installed or not on PATH. Start Postgres and Mongo manually before continuing."
    $shouldWait = $false
}

if (-not $shouldWait) {
    Write-Step "Skipping Docker health checks; verify your databases are running before migrations"
}

Write-Step "Generating Prisma clients"
# On Windows prisma generate can fail due to file locks when moving the query engine DLL.
# Proactively remove stale tmp files and move the existing DLL out of the way so generate can succeed.
$prismaClientDir = Join-Path $PSScriptRoot '..\node_modules\.prisma\client'
if (Test-Path $prismaClientDir) {
    Get-ChildItem -Path $prismaClientDir -Filter 'query_engine-windows.dll.node.tmp*' -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
    $dll = Join-Path $prismaClientDir 'query_engine-windows.dll.node'
    if (Test-Path $dll) {
        Rename-Item -Path $dll -NewName 'query_engine-windows.dll.node.bak' -ErrorAction SilentlyContinue
    }
}
[void](Run-Command 'pnpm' @('-r', '--if-present', 'prisma:generate') -AllowFailure)

Write-Step "Running migrations and seed (idempotent)"
if ($env:SKIP_SEED_IMAGE_DOWNLOAD -ne '1') {
    Write-Step "Downloading and caching seed images (optional)"
    Run-Command 'node' @('scripts/download-seed-images.js', '--dry') -AllowFailure
} else {
    Write-Host "SKIP_SEED_IMAGE_DOWNLOAD=1 detected; skipping seed image download step"
}

Run-Command 'node' @($NodeDispatcher, 'migrate-and-seed')

if ($env:SKIP_SEED_IMAGE_FIX -ne '1') {
    Write-Step "Validating and fixing seed images in MongoDB"
    # run in non-dry mode by default; scripts/fix-seed-images.js will connect to MONGO_URL or default
    Run-Command 'node' @('scripts/fix-seed-images.js') -AllowFailure
} else {
    Write-Host "SKIP_SEED_IMAGE_FIX=1 detected; skipping seed image fix step"
}

Write-Step "Setup complete. Next steps: pnpm run dev"
