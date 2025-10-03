Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$user = if ($env:DB_USER) { $env:DB_USER } else { 'ecom' }
$database = if ($env:DB_NAME) { $env:DB_NAME } else { 'ecom' }

$tries = 0
Write-Host "Waiting for Postgres..."
while ($tries -lt 60) {
    try {
        docker compose exec -T db pg_isready -U $user -d $database | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Postgres is ready."
            exit 0
        }
    } catch {
        Start-Sleep -Seconds 2
        $tries++
        continue
    }
    Start-Sleep -Seconds 2
    $tries++
}
Write-Error "Postgres did not become ready in time."
exit 1
