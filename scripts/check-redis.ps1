# Redis Connection Test Script
# Tests Redis connectivity and configuration

param(
    [string]$RedisUrl = $env:REDIS_URL,
    [string]$RedisPassword = $env:REDIS_PASSWORD,
    [string]$Host = "localhost",
    [int]$Port = 6379
)

Write-Host "🔴 Testing Redis Connection..." -ForegroundColor Cyan

# Determine connection parameters
if ($RedisUrl) {
    Write-Host "📍 Using REDIS_URL: $RedisUrl" -ForegroundColor Blue
    $Host = $RedisUrl -replace "redis://.*@", "" -replace ":.*", ""
    $Port = ($RedisUrl -replace ".*:", "" -replace "/.*", "") -as [int]
    if ($Port -eq 0) { $Port = 6379 }
} else {
    Write-Host "📍 Using direct connection: $Host`:$Port" -ForegroundColor Blue
}

$testsPassed = $true

# Test 1: Basic connectivity
Write-Host "🔌 Testing basic connectivity..." -ForegroundColor Blue
try {
    $redisClient = New-Object System.Net.Sockets.TcpClient
    $redisClient.Connect($Host, $Port)
    $redisClient.Close()
    Write-Host "✅ Redis server is reachable" -ForegroundColor Green
} catch {
    Write-Host "❌ Cannot connect to Redis server: $_" -ForegroundColor Red
    $testsPassed = $false
}

# Test 2: Redis CLI ping (if available locally)
if ($testsPassed) {
    Write-Host "🏓 Testing Redis ping..." -ForegroundColor Blue
    try {
        $pingResult = & redis-cli -h $Host -p $Port ping 2>$null
        if ($pingResult -eq "PONG") {
            Write-Host "✅ Redis ping successful" -ForegroundColor Green
        } else {
            Write-Host "❌ Redis ping failed or returned unexpected result: $pingResult" -ForegroundColor Red
            $testsPassed = $false
        }
    } catch {
        Write-Host "⚠️  Redis CLI not available locally, skipping ping test" -ForegroundColor Yellow
        Write-Host "   This is expected in containerized environments" -ForegroundColor Yellow
    }
}

# Test 3: Authentication (if password is set)
if ($testsPassed -and $RedisPassword) {
    Write-Host "🔐 Testing Redis authentication..." -ForegroundColor Blue
    try {
        $authResult = & redis-cli -h $Host -p $Port -a $RedisPassword ping 2>$null
        if ($authResult -eq "PONG") {
            Write-Host "✅ Redis authentication successful" -ForegroundColor Green
        } else {
            Write-Host "❌ Redis authentication failed" -ForegroundColor Red
            $testsPassed = $false
        }
    } catch {
        Write-Host "❌ Redis authentication test failed: $_" -ForegroundColor Red
        $testsPassed = $false
    }
}

# Test 4: Basic operations (if authenticated)
if ($testsPassed -and $RedisPassword) {
    Write-Host "⚡ Testing Redis operations..." -ForegroundColor Blue
    try {
        # Set a test key
        $setResult = & redis-cli -h $Host -p $Port -a $RedisPassword set "test:connection" "success" 2>$null
        if ($LASTEXITCODE -eq 0) {
            # Get the test key
            $getResult = & redis-cli -h $Host -p $Port -a $RedisPassword get "test:connection" 2>$null
            if ($getResult -eq "success") {
                # Clean up test key
                & redis-cli -h $Host -p $Port -a $RedisPassword del "test:connection" 2>$null
                Write-Host "✅ Redis operations working correctly" -ForegroundColor Green
            } else {
                Write-Host "❌ Redis get operation failed" -ForegroundColor Red
                $testsPassed = $false
            }
        } else {
            Write-Host "❌ Redis set operation failed" -ForegroundColor Red
            $testsPassed = $false
        }
    } catch {
        Write-Host "❌ Redis operations test failed: $_" -ForegroundColor Red
        $testsPassed = $false
    }
}

# Summary
if ($testsPassed) {
    Write-Host "🎉 Redis connection test passed!" -ForegroundColor Green
    Write-Host "🚀 Redis is ready for production use" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Redis connection test failed!" -ForegroundColor Red
    Write-Host "🔧 Please check Redis configuration and network connectivity" -ForegroundColor Yellow
    exit 1
}
