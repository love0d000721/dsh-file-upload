# dsh-file-upload one-shot copy.
# Keep the embedded copy of this file in src/host/body.js in sync
# (tests/drift.test.mjs fails when they diverge).

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { exit 2 }
$req = $raw | ConvertFrom-Json
$destRoot = [string]$req.destRoot
if (-not (Test-Path -LiteralPath $destRoot -PathType Container)) {
  New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
}
$results = @()
foreach ($src in @($req.paths)) {
  $s = [string]$src
  if (-not (Test-Path -LiteralPath $s -PathType Leaf)) {
    $results += [pscustomobject]@{ source = $s; ok = $false; error = 'source-missing'; dest = $null }
    continue
  }
  $name = [System.IO.Path]::GetFileName($s)
  $dest = Join-Path $destRoot $name
  $i = 1
  while (Test-Path -LiteralPath $dest) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    $ext = [System.IO.Path]::GetExtension($name)
    $dest = Join-Path $destRoot ("{0} ({1}){2}" -f $base, $i, $ext)
    $i += 1
  }
  try {
    Copy-Item -LiteralPath $s -Destination $dest -Force
    $results += [pscustomobject]@{ source = $s; ok = $true; error = $null; dest = [string]$dest }
  } catch {
    $results += [pscustomobject]@{ source = $s; ok = $false; error = $_.Exception.Message; dest = $null }
  }
}
$results | ConvertTo-Json -Compress -Depth 4
