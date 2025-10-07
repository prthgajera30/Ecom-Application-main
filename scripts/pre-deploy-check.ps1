# Pre-Deployment Validation Script
# Run this before production deployments to ensure everything is ready

param(
    [switch]$SkipLockfileValidation,
    [switch]$SkipBuildTest,
    [switch]$SkipPrismaValidation
)

Write-Host "🚀 Starting pre-deployment checks..." -ForegroundColor Cyan

$allChecksPassed = $true

# 1. Lockfile Validation
if (!$SkipLockfileValidation) {
    Write-Host "🔍 Checking lockfile synchronization..." -ForegroundColor Blue
    try {
        $lockfileScript = Join-Path $PSScriptRoot "validate-lockfiles.ps1"
        & $lockfileScript
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Lockfile validation passed" -ForegroundColor Green
        } else {
            Write-Host "❌ Lockfile validation failed" -ForegroundColor Red
            $allChecksPassed = $false
        }
    }
    catch {
        Write-Host "❌ Lockfile validation error: $_" -ForegroundColor Red
        $allChecksPassed = $false
    }
}

# 2. Build Test
if (!$SkipBuildTest) {
    Write-Host "🔨 Testing build process..." -ForegroundColor Blue
    try {
        $buildResult = pnpm build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Build test passed" -ForegroundColor Green
        } else {
            Write-Host "❌ Build test failed" -ForegroundColor Red
            Write-Host $buildResult -ForegroundColor Red
            $allChecksPassed = $false
        }
    }
    catch {
        Write-Host "❌ Build test error: $_" -ForegroundColor Red
        $allChecksPassed = $false
    }
}

# 3. Prisma Validation
if (!$SkipPrismaValidation) {
    Write-Host "🗄️  Checking Prisma schema..." -ForegroundColor Blue
    try {
        $prismaResult = pnpm prisma generate --schema=apps/api/prisma/schema.prisma 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Prisma validation passed" -ForegroundColor Green
        } else {
            Write-Host "❌ Prisma validation failed" -ForegroundColor Red
            Write-Host $prismaResult -ForegroundColor Red
            $allChecksPassed = $false
        }
    }
    catch {
        Write-Host "❌ Prisma validation error: $_" -ForegroundColor Red
        $allChecksPassed = $false
    }
}

# 4. Environment Files Check
Write-Host "📋 Checking environment configuration..." -ForegroundColor Blue
$envExample = "infra/env.prod.example"
$envProd = "infra/env.prod"

if (Test-Path $envExample) {
    if (Test-Path $envProd) {
        Write-Host "✅ Production environment file exists" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Production environment file not found. Copy from env.prod.example" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  No environment example file found" -ForegroundColor Yellow
}

# Summary
if ($allChecksPassed) {
    Write-Host "🎉 All pre-deployment checks passed!" -ForegroundColor Green
    Write-Host "🚀 Ready for production deployment" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Some pre-deployment checks failed!" -ForegroundColor Red
    Write-Host "🔧 Please fix the issues above before deploying" -ForegroundColor Yellow
    exit 1
}
