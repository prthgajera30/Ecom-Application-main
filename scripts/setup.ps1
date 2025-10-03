Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step($Message) {
    Write-Host "`n==> $Message"
}

Write-Step "Ensuring Corepack is enabled"
if (Get-Command corepack -ErrorAction SilentlyContinue) {
    corepack enable | Out-Null
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
    corepack prepare pnpm@9.12.3 --activate | Out-Null
}
$pnpmVersion = pnpm --version
Write-Host "pnpm $pnpmVersion"

Write-Step "Installing workspace dependencies"
pnpm install --recursive

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

Write-Step "Starting PostgreSQL and MongoDB containers"
docker compose up -d db mongo | Out-Null

Write-Step "Waiting for PostgreSQL to become ready"
powershell -ExecutionPolicy Bypass -File ./scripts/db-wait.ps1

Write-Step "Generating Prisma clients"
pnpm -r --if-present prisma:generate | Out-Null

Write-Step "Applying migrations"
pnpm --filter @apps/api prisma:migrate

if (-not (Test-Path '.first-run-done')) {
    Write-Step "First run detected – seeding database"
    pnpm --filter @apps/api prisma:seed
    New-Item -Path '.first-run-done' -ItemType File | Out-Null
} else {
    Write-Step "Seed already applied (remove .first-run-done to rerun)"
}

Write-Step "Setup complete. Next steps: pnpm run dev"
