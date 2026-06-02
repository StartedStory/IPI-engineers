# Stops processes listening on IPI dev ports (4000 API, 5173/5174 Vite).
$ports = @(4000, 5173, 5174)
$killed = @()

foreach ($port in $ports) {
  $lines = netstat -ano | Select-String "LISTENING" | Select-String ":$port\s"
  foreach ($line in $lines) {
    $parts = ($line -replace '\s+', ' ').Trim().Split(' ')
    $processId = $parts[-1]
    if ($processId -match '^\d+$' -and $processId -notin $killed) {
      Write-Host "Stopping PID $processId (port $port)..."
      taskkill /PID $processId /F 2>$null | Out-Null
      $killed += $processId
    }
  }
}

if ($killed.Count -eq 0) {
  Write-Host "No processes found on ports $($ports -join ', ')."
} else {
  Write-Host "Done. Ports cleared."
}
