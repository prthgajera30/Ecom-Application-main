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

    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        if ($AllowFailure) {
            if ($ErrorHint) {
                Write-Warning $ErrorHint
            }
            return $exitCode
        }

        if ($ErrorHint) {
            Write-Error $ErrorHint
        }
        exit $exitCode
    }

    return 0
}

function Invoke-Migrate {
    $output = & pnpm --filter @apps/api prisma:migrate 2>&1
    $exitCode = $LASTEXITCODE
    if ($output) { $output | ForEach-Object { Write-Host $_ } }
    return @{ Code = $exitCode; Text = ($output -join "`n") }
}

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
Run-Command 'pnpm' @('install', '--recursive')

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
        Run-Command 'powershell' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', './scripts/db-wait.ps1') -ErrorHint 'Postgres did not become healthy. Inspect the container logs or start your local database manually before continuing.'
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
[void](Run-Command 'pnpm' @('-r', '--if-present', 'prisma:generate') -AllowFailure)

Write-Step "Applying migrations"
$result = Invoke-Migrate
$autoResetEnabled = $true
if ($env:AUTO_RESET_DB_ON_P1000) {
    $normalized = $env:AUTO_RESET_DB_ON_P1000.ToString().ToLowerInvariant()
    if ($normalized -eq '0' -or $normalized -eq 'false') {
        $autoResetEnabled = $false
    }
}
if ($result.Code -ne 0) {
    $isFirstRun = -not (Test-Path '.first-run-done')
    $hasDocker = Get-Command docker -ErrorAction SilentlyContinue
    $composeRunning = $false
    if ($hasDocker) {
        try {
            docker compose ps --status running db | Out-Null
            if ($LASTEXITCODE -eq 0) { $composeRunning = $true }
        } catch {}
    }
    $sawP1000 = $result.Text -match 'P1000'
    $sawP3018 = $result.Text -match 'P3018'
    $autoResetBlockReason = $null
    if (-not $autoResetEnabled) { $autoResetBlockReason = 'AUTO_RESET_DB_ON_P1000 is disabled' }
    elseif (-not $isFirstRun) { $autoResetBlockReason = 'setup has already completed once' }
    elseif (-not $hasDocker) { $autoResetBlockReason = 'docker is not available' }
    elseif (-not $composeRunning) { $autoResetBlockReason = 'docker compose db service is not running' }

    if ($result.Code -ne 0 -and ($sawP1000 -or $sawP3018) -and $isFirstRun -and $autoResetEnabled -and $composeRunning) {
        $reason = if ($sawP3018) { 'migration failure (P3018)' } else { 'authentication failure (P1000)' }
        Write-Warning "Prisma reported a $reason. Resetting the Docker Postgres volume and retrying once..."
        Run-Command 'docker' @('compose', 'down', '--volumes', '--remove-orphans')
        Run-Command 'docker' @('compose', 'up', '-d', 'db', 'mongo')
        Run-Command 'powershell' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', './scripts/db-wait.ps1')
        $result = Invoke-Migrate
    } elseif ($sawP1000) {
        if ($autoResetBlockReason) { Write-Warning "Automatic Docker reset was skipped because $autoResetBlockReason." }
        Write-Error 'Prisma migrations failed with P1000. Ensure your DATABASE_URL credentials match the running Postgres instance. Set AUTO_RESET_DB_ON_P1000=1 to allow the setup script to reset the Docker volume automatically.'
        exit $result.Code
    } elseif ($sawP3018) {
        if ($autoResetBlockReason) { Write-Warning "Automatic Docker reset was skipped because $autoResetBlockReason." }
        Write-Error 'Prisma migrations failed with P3018. Inspect the failing migration or reset the Docker volume (docker compose down --volumes) before rerunning.'
        exit $result.Code
    }

    if ($result.Code -ne 0) {
        Write-Error 'Prisma migrations failed. Ensure your DATABASE_URL credentials match the running Postgres instance. If you changed credentials recently, run `docker compose down --volumes` to reset the database volume before retrying.'
        exit $result.Code
    } else {
        Write-Host 'Migrations succeeded after resetting the Postgres volume.'
    }
}

if (-not (Test-Path '.first-run-done')) {
    Write-Step "First run detected – seeding database"
    Run-Command 'pnpm' @('--filter', '@apps/api', 'prisma:seed')
    New-Item -Path '.first-run-done' -ItemType File | Out-Null
} else {
    Write-Step "Seed already applied (remove .first-run-done to rerun)"
}

Write-Step "Setup complete. Next steps: pnpm run dev"
