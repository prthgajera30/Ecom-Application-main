param (
    [switch]$StartServices,
    [switch]$SkipPrereqCheck
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

$pnpmCmd = (Get-Command pnpm -ErrorAction SilentlyContinue).Source
if (-not $pnpmCmd) { $pnpmCmd = 'pnpm.cmd' }

function Add-ToPath {
    param([string]$Candidate)
    if ([string]::IsNullOrWhiteSpace($Candidate)) { return }
    if (-not (Test-Path $Candidate)) { return }
    if (($env:PATH -split ';') -notcontains $Candidate) {
        $env:PATH = "$Candidate;$env:PATH"
    }
}

function Invoke-CommandChecked {
    param (
        [scriptblock]$Command,
        [string]$Description,
        [int]$Retries = 1,
        [int]$DelaySeconds = 2
    )

    for ($attempt = 1; $attempt -le [math]::Max(1, $Retries); $attempt++) {
        if ($attempt -gt 1) { Start-Sleep -Seconds $DelaySeconds }
        & $Command
        if ($LASTEXITCODE -eq 0) { return }
        Write-Host "  ! $Description failed (attempt $attempt, exit code $LASTEXITCODE)" -ForegroundColor Yellow
    }
    throw "$Description failed"
}

function Stop-ProcessTree {
    param([int]$Id)
    try {
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $Id"
    } catch {
        $children = @()
    }
    foreach ($child in $children) {
        Stop-ProcessTree -Id $child.ProcessId
    }
    try {
        Stop-Process -Id $Id -Force -ErrorAction SilentlyContinue
    } catch {}
}

function Stop-ByCommandPattern {
    param([string[]]$Patterns)
    $processes = Get-CimInstance -ClassName Win32_Process | Where-Object { $_.CommandLine }
    foreach ($pattern in $Patterns) {
        $matches = $processes | Where-Object { $_.CommandLine -like "*$pattern*" }
        foreach ($match in $matches) {
            try {
                Stop-Process -Id $match.ProcessId -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }
}

$pathHints = @(
    'C:\Program Files\nodejs',
    "${env:APPDATA}\npm",
    "$repoRoot\.venv\Scripts",
    'C:\Program Files\PostgreSQL\16\bin',
    'C:\Program Files\PostgreSQL\15\bin',
    'C:\Program Files\MongoDB\Server\8.2\bin',
    'C:\Program Files\MongoDB\Server\7.0\bin'
)
$pathHints | ForEach-Object { Add-ToPath $_ }

Write-Host '=== E-commerce Personalization Repo Setup ==='

if (-not $SkipPrereqCheck) {
    Write-Host '* Checking prerequisites...'
    $checks = @(
        @{ Name = 'Node'; Cmd = 'node -v' },
        @{ Name = 'pnpm'; Cmd = 'pnpm -v' },
        @{ Name = 'Python'; Cmd = 'python --version' },
        @{ Name = 'Postgres service'; Cmd = 'Get-Service postgresql-x64-16' },
        @{ Name = 'MongoDB service'; Cmd = 'Get-Service MongoDB' }
    )
    foreach ($check in $checks) {
        try {
            if ($check.Name -like '*service*') {
                Invoke-Expression $check.Cmd | Out-Null
                Write-Host "  - $($check.Name): running"
            } else {
                $v = Invoke-Expression $check.Cmd
                Write-Host "  - $($check.Name): $v"
            }
        } catch {
            Write-Host "  ! Missing prerequisite: $($check.Name)." -ForegroundColor Red
            Write-Host '    Please install before rerunning.' -ForegroundColor Red
            return
        }
    }
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host '  ! psql executable not found in PATH. Install PostgreSQL client tools or update PATH.' -ForegroundColor Red
    return
}

Write-Host '* Ensuring Postgres database exists...'
$env:PGPASSWORD = $env:PGPASSWORD ?? 'postgres'
try {
    & psql -U postgres -h localhost -c "SELECT 'connected to Postgres';" | Out-Host
    $exists = & psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname = 'shop';"
    if (-not $exists) {
        Write-Host '  - Creating database shop'
        & psql -U postgres -h localhost -c 'CREATE DATABASE shop;'
    }
} catch {
    Write-Host '  ! Unable to reach Postgres. Ensure service is running and credentials are correct.' -ForegroundColor Red
    return
}

if (-not (Test-Path "$repoRoot\apps\api\.env")) {
    Write-Host '  ! Missing apps/api/.env. Copy from example before running.' -ForegroundColor Red
    return
}
if (-not (Test-Path "$repoRoot\apps\web\.env")) {
    Write-Host '  ! Missing apps/web/.env. Copy from example before running.' -ForegroundColor Red
    return
}

Write-Host '* Installing JS dependencies (workspace root + apps)...'
Invoke-CommandChecked -Command { pnpm install } -Description 'pnpm install'
Invoke-CommandChecked -Command { pnpm --filter ./apps/api install } -Description 'pnpm install apps/api'
Invoke-CommandChecked -Command { pnpm --filter ./apps/web install } -Description 'pnpm install apps/web'

Write-Host '* Setting up Python environment (.venv)...'
if (-not (Test-Path "$repoRoot\.venv")) {
    Invoke-CommandChecked -Command { python -m venv .venv } -Description 'python -m venv .venv'
}
Invoke-CommandChecked -Command { .\.venv\Scripts\pip.exe install -r apps/recs/requirements.txt } -Description 'pip install recs requirements'

Write-Host '* Running Prisma migrate...'
$env:POSTGRES_URL = $env:POSTGRES_URL ?? 'postgres://postgres:postgres@localhost:5432/shop'
$env:MONGO_URL = $env:MONGO_URL ?? 'mongodb://127.0.0.1:27017/shop'
$env:JWT_SECRET = $env:JWT_SECRET ?? 'change_me'
$env:STRIPE_SECRET_KEY = $env:STRIPE_SECRET_KEY ?? 'sk_test_xxx'
$env:STRIPE_WEBHOOK_SECRET = $env:STRIPE_WEBHOOK_SECRET ?? 'whsec_xxx'
$env:RECS_URL = $env:RECS_URL ?? 'http://127.0.0.1:5000'
Invoke-CommandChecked -Command { pnpm migrate } -Description 'pnpm migrate'

Write-Host '* Seeding data via API workspace...'
Invoke-CommandChecked -Command { pnpm --filter ./apps/api run seed } -Description 'api seed'

Write-Host '* Smoke testing services...'
Write-Host '  - API health'
$apiProcess = Start-Process -FilePath $pnpmCmd -ArgumentList '--filter','./apps/api','dev' -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 8
try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/health' | Out-Host
} catch {
    Write-Host '    API health request failed.' -ForegroundColor Yellow
}
Stop-ProcessTree -Id $apiProcess.Id
Stop-ByCommandPattern -Patterns @('apps\\api')

Write-Host '  - Recs health'
$recsProcess = Start-Process -FilePath '.\.venv\Scripts\python.exe' -ArgumentList 'apps/recs/app.py' -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5
try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:5000/health' | Out-Host
} catch {
    Write-Host '    Recs health request failed.' -ForegroundColor Yellow
}
Stop-ProcessTree -Id $recsProcess.Id
Stop-ByCommandPattern -Patterns @('apps\\recs')

Write-Host '  - Web dev server ping'
$webProcess = Start-Process -FilePath $pnpmCmd -ArgumentList '--filter','./apps/web','dev' -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 20
try {
    (Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing).StatusCode | Out-Host
} catch {
    Write-Host '    Web ping failed.' -ForegroundColor Yellow
}
Stop-ProcessTree -Id $webProcess.Id
Stop-ByCommandPattern -Patterns @('apps\\web','next dev -p 3000')

Write-Host '=== Setup complete ==='

if ($StartServices) {
    Write-Host 'Starting dev services (Ctrl+C to stop)...'
    Start-Process -FilePath $pnpmCmd -ArgumentList 'dev' -WorkingDirectory $repoRoot
}
