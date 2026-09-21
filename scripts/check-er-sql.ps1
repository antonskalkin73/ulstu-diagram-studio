param(
  [string]$SqlFile = 'test-results/schema.sql',
  [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin'
)
$ErrorActionPreference = 'Stop'
$sqlPath = (Resolve-Path -LiteralPath $SqlFile).Path
$checkDirectory = Join-Path (Get-Location) ('test-results\pg-check-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $checkDirectory | Out-Null
$started = $false
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$env:PGCLIENTENCODING = 'UTF8'
try {
  & "$PostgresBin\initdb.exe" -D "$checkDirectory\data" -A trust -U er_test --no-locale -E UTF8 *> "$checkDirectory\init.log"
  if ($LASTEXITCODE -ne 0) { Get-Content "$checkDirectory\init.log"; throw 'initdb failed' }
  & "$PostgresBin\pg_ctl.exe" -D "$checkDirectory\data" -l "$checkDirectory\server.log" -o "-p $port -h 127.0.0.1" -w start
  if ($LASTEXITCODE -ne 0) { Get-Content "$checkDirectory\server.log"; throw 'pg_ctl failed' }
  $started = $true
  & "$PostgresBin\psql.exe" -h 127.0.0.1 -p $port -U er_test -d postgres -v ON_ERROR_STOP=1 -f $sqlPath
  if ($LASTEXITCODE -ne 0) { throw 'Generated SQL failed on PostgreSQL 18' }
  & "$PostgresBin\psql.exe" -h 127.0.0.1 -p $port -U er_test -d postgres -c 'SELECT version();' -c 'SELECT conname, contype FROM pg_constraint WHERE connamespace = ''public''::regnamespace ORDER BY conname;'
  if ($LASTEXITCODE -ne 0) { throw 'Schema inspection failed' }
} finally {
  if ($started) {
    & "$PostgresBin\pg_ctl.exe" -D "$checkDirectory\data" -m fast -w stop
    if ($LASTEXITCODE -ne 0) { throw "Temporary PostgreSQL instance was not stopped: $checkDirectory" }
  }
}
