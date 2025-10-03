Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$host = if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }
$port = if ($env:DB_PORT) { [int]$env:DB_PORT } else { 5432 }
$user = if ($env:DB_USER) { $env:DB_USER } else { 'ecom' }
$database = if ($env:DB_NAME) { $env:DB_NAME } else { 'ecom' }
$password = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { 'ecom' }

$usingDocker = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        docker compose ps --status running db | Out-Null
        if ($LASTEXITCODE -eq 0) { $usingDocker = $true }
    } catch {}
}

$tries = 0
Write-Host ("Waiting for Postgres at {0}:{1}..." -f $host, $port)
while ($tries -lt 60) {
    if ($usingDocker) {
        try {
            docker compose exec -T db pg_isready -U $user -d $database | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Postgres is ready."
                exit 0
            }
        } catch {}
    } else {
        if (Get-Command pg_isready -ErrorAction SilentlyContinue) {
            $env:PGPASSWORD = $password
            pg_isready -h $host -p $port -U $user -d $database | Out-Null
            Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Postgres is ready."
                exit 0
            }
        } else {
            $result = Test-NetConnection -ComputerName $host -Port $port -WarningAction SilentlyContinue
            if ($result.TcpTestSucceeded) {
                Write-Host "Postgres port is accepting TCP connections."
                exit 0
            }
        }
    }
    Start-Sleep -Seconds 2
    $tries++
}

Write-Error "Postgres did not become ready in time."
if ($usingDocker) {
    docker compose logs --tail 20 db | Out-Null
}
exit 1
