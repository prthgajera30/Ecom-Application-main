# Lockfile Validation Script
# This script ensures lockfiles are in sync with package.json files before production builds

Write-Host "🔍 Validating lockfiles..." -ForegroundColor Cyan

# Function to check if lockfile is in sync with package.json
function Test-LockfileSync {
    param (
        [string]$Directory = "."
    )

    $packageJson = Join-Path $Directory "package.json"
    $lockfile = Join-Path $Directory "pnpm-lock.yaml"

    if (!(Test-Path $packageJson)) {
        Write-Host "⚠️  No package.json found in $Directory" -ForegroundColor Yellow
        return $true
    }

    if (!(Test-Path $lockfile)) {
        Write-Host "❌ No lockfile found in $Directory" -ForegroundColor Red
        return $false
    }

    Write-Host "📦 Checking $Directory..." -ForegroundColor Blue

    # Try to install with frozen lockfile to validate sync
    try {
        $result = pnpm install --frozen-lockfile --silent 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Lockfile is in sync for $Directory" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Lockfile is out of sync for $Directory" -ForegroundColor Red
            Write-Host "🔧 Run 'pnpm install' to update lockfiles" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "❌ Lockfile is out of sync for $Directory" -ForegroundColor Red
        Write-Host "🔧 Run 'pnpm install' to update lockfiles" -ForegroundColor Yellow
        return $false
    }
}

# Validate root lockfile
$rootSync = Test-LockfileSync -Directory "."

# Validate workspace lockfiles
$allSynced = $true
Get-ChildItem "apps" -Directory | ForEach-Object {
    $dir = $_.FullName
    if (Test-Path (Join-Path $dir "package.json")) {
        $sync = Test-LockfileSync -Directory $dir
        if (!$sync) {
            $allSynced = $false
        }
    }
}

if ($allSynced) {
    Write-Host "🎉 Lockfile validation complete!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Lockfile validation failed!" -ForegroundColor Red
    exit 1
}
