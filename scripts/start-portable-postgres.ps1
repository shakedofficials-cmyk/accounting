$ErrorActionPreference = "Stop"

$root = Join-Path $env:LOCALAPPDATA "ShakedFinanceOS"
$bin = Join-Path $root "postgresql-17.9\pgsql\bin"
$data = Join-Path $root "pgdata"
$log = Join-Path $root "postgres.log"

if (-not (Test-Path (Join-Path $bin "pg_ctl.exe"))) {
  throw "Portable PostgreSQL binaries were not found at $bin."
}

if (-not (Test-Path $data)) {
  throw "Portable PostgreSQL data directory was not found at $data."
}

& (Join-Path $bin "pg_ctl.exe") -D $data -l $log -w start
