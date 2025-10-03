Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$Arguments = @()
    )

    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        exit $exitCode
    }
}

function Invoke-Migrate {
    $output = & pnpm --filter @apps/api prisma:migrate 2>&1
    $exitCode = $LASTEXITCODE
    if ($output) { $output | ForEach-Object { Write-Host $_ } }
    return @{ Code = $exitCode; Text = ($output -join "`n") }
}

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
    $autoResetBlockReason = $null
    if (-not $autoResetEnabled) { $autoResetBlockReason = 'AUTO_RESET_DB_ON_P1000 is disabled' }
    elseif (-not $isFirstRun) { $autoResetBlockReason = 'setup has already completed once' }
    elseif (-not $hasDocker) { $autoResetBlockReason = 'docker is not available' }
    elseif (-not $composeRunning) { $autoResetBlockReason = 'docker compose db service is not running' }

    if ($result.Code -ne 0 -and $sawP1000 -and $isFirstRun -and $autoResetEnabled -and $composeRunning) {
        Write-Warning 'Prisma reported an authentication failure (P1000). Resetting the Docker Postgres volume and retrying once...'
        Invoke-CheckedCommand 'docker' @('compose', 'down', '--volumes')
        Invoke-CheckedCommand 'docker' @('compose', 'up', '-d', 'db', 'mongo')
        Invoke-CheckedCommand 'powershell' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', './scripts/db-wait.ps1')
        $result = Invoke-Migrate
    } elseif ($sawP1000) {
        if ($autoResetBlockReason) { Write-Warning "Automatic Docker reset was skipped because $autoResetBlockReason." }
        Write-Error 'Prisma migrations failed with P1000. Ensure your DATABASE_URL credentials match the running Postgres instance. Set AUTO_RESET_DB_ON_P1000=1 to allow the script to reset the Docker volume automatically.'
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
    pnpm --filter @apps/api prisma:seed
    New-Item -Path '.first-run-done' -ItemType File | Out-Null
    Write-Host 'Database seeded (created .first-run-done marker).'
} else {
    Write-Host 'Seed skipped; .first-run-done already exists.'
}
