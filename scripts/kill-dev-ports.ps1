# Kill known dev ports (Windows PowerShell)
$ports = @(3000, 4000)
foreach ($port in $ports) {
  $matches = netstat -ano | Select-String ":$port"
  if ($matches) {
    $pids = $matches | ForEach-Object { ($_ -replace '^\s+','') -split '\s+' | Select-Object -Last 1 } | Sort-Object -Unique
    foreach ($pid in $pids) {
      try {
        Write-Output "Stopping process $pid listening on port $port"
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      } catch {
        Write-Output "Failed to stop PID $pid: $_"
      }
    }
  } else {
    Write-Output "No process found on port $port"
  }
}
