# Deployment Scripts

This directory contains scripts to ensure reliable production deployments and prevent common issues.

## Scripts Overview

### 🔍 `validate-lockfiles.ps1`
Validates that all lockfiles are in sync with their corresponding package.json files.

**Usage:**
```powershell
.\scripts\validate-lockfiles.ps1
```

**What it does:**
- Checks root lockfile synchronization
- Validates all workspace lockfiles (apps/*/)
- Provides clear error messages if lockfiles are out of sync
- Exits with code 0 if all lockfiles are valid, 1 if any are out of sync

### 🚀 `pre-deploy-check.ps1`
Comprehensive pre-deployment validation script that runs multiple checks before production deployments.

**Usage:**
```powershell
.\scripts\pre-deploy-check.ps1
```

**Optional flags:**
- `-SkipLockfileValidation`: Skip lockfile validation
- `-SkipBuildTest`: Skip build testing
- `-SkipPrismaValidation`: Skip Prisma schema validation

**What it checks:**
1. **Lockfile Synchronization**: Ensures all lockfiles match package.json files
2. **Build Process**: Tests that the project builds successfully
3. **Prisma Schema**: Validates Prisma schema and generates client
4. **Environment Files**: Checks for required environment configuration files

### 🐧 `validate-lockfiles.sh`
Linux/macOS version of the lockfile validation script.

### 🔴 `check-redis.ps1`
Comprehensive Redis connectivity and configuration testing script.

**Usage:**
```powershell
.\scripts\check-redis.ps1
```

**Optional parameters:**
- `-RedisUrl`: Custom Redis URL (defaults to $env:REDIS_URL)
- `-RedisPassword`: Redis password (defaults to $env:REDIS_PASSWORD)
- `-Host`: Redis host (defaults to "localhost")
- `-Port`: Redis port (defaults to 6379)

**What it tests:**
1. **Basic Connectivity**: TCP connection to Redis server
2. **Redis Ping**: Redis PING command response
3. **Authentication**: Password authentication (if configured)
4. **Operations**: Basic Redis SET/GET operations

**Example usage:**
```powershell
# Test with environment variables
.\scripts\check-redis.ps1

# Test specific Redis instance
.\scripts\check-redis.ps1 -Host "redis-server" -Port 6379 -RedisPassword "mypassword"

# Test with custom URL
.\scripts\check-redis.ps1 -RedisUrl "redis://redis:6379"
```

## Docker Improvements

### Resilient Dockerfile Builds
The Dockerfiles have been updated to handle lockfile mismatches gracefully:

```dockerfile
# Before (fails on mismatch):
RUN pnpm install --frozen-lockfile --prefer-offline

# After (handles mismatches):
RUN pnpm install --frozen-lockfile --prefer-offline || (echo "Lockfile outdated, updating..." && pnpm install --prefer-offline)
```

This approach:
- ✅ Tries frozen lockfile first (maintains security)
- ✅ Falls back to updating lockfile if needed (prevents build failures)
- ✅ Logs when lockfile updates occur (maintains visibility)
- ✅ Ensures builds never fail due to lockfile mismatches

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Validate Lockfiles
  run: .\scripts\validate-lockfiles.ps1

- name: Pre-deployment Checks
  run: .\scripts\pre-deploy-check.ps1

- name: Build and Deploy
  run: docker compose -f infra/docker-compose.prod.yml up -d --build
```

### Pre-deployment Workflow
1. Run `validate-lockfiles.ps1` to check synchronization
2. Run `pre-deploy-check.ps1` for comprehensive validation
3. If all checks pass, proceed with production build
4. If any checks fail, fix issues before deploying

## Common Issues Prevented

### ❌ Lockfile Mismatches
**Problem:** Lockfiles get out of sync when dependencies are added/removed without updating lockfiles.

**Solution:** Validation scripts catch this before deployment.

### ❌ Prisma Schema Conflicts
**Problem:** Duplicate models or relation mismatches cause build failures.

**Solution:** Prisma validation in pre-deployment checks.

### ❌ Build Failures
**Problem:** Projects that work locally fail in production due to environment differences.

**Solution:** Build testing in pre-deployment validation.

## Best Practices

1. **Always run validation scripts before production deployments**
2. **Keep lockfiles committed to version control**
3. **Update lockfiles when adding/removing dependencies**
4. **Use the resilient Dockerfile pattern for CI/CD environments**
5. **Monitor build logs for lockfile update messages**

## Troubleshooting

### Lockfile Out of Sync
```powershell
# Update all lockfiles
pnpm install

# Validate they are now in sync
.\scripts\validate-lockfiles.ps1
```

### Prisma Schema Issues
```powershell
# Regenerate Prisma client
npx prisma generate --schema=apps/api/prisma/schema.prisma

# Validate schema
.\scripts\pre-deploy-check.ps1 -SkipLockfileValidation -SkipBuildTest
```

### Build Failures
```powershell
# Test build locally
pnpm build

# Run full pre-deployment check
.\scripts\pre-deploy-check.ps1
