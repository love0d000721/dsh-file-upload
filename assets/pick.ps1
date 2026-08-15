# dsh-file-upload one-shot file picker.
# Keep the embedded copy of this file in src/host/body.js in sync
# (tests/drift.test.mjs fails when they diverge).

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialogScript = {
  Add-Type -AssemblyName System.Windows.Forms
  $d = New-Object System.Windows.Forms.OpenFileDialog
  $d.Title = 'Select files to upload'
  $d.Filter = 'All files (*.*)|*.*'
  $d.Multiselect = $true
  $d.CheckFileExists = $true
  [Console]::Out.WriteLine('READY')
  [Console]::Out.Flush()
  $r = $d.ShowDialog()
  if ($r.ToString() -eq 'OK') {
    [pscustomobject]@{ cancelled = $false; paths = @($d.FileNames) } | ConvertTo-Json -Compress
  } else {
    [pscustomobject]@{ cancelled = $true; paths = @() } | ConvertTo-Json -Compress
  }
}
if ([System.Threading.Thread]::CurrentThread.ApartmentState -eq [System.Threading.ApartmentState]::STA) {
  & $dialogScript
} else {
  $rs = [runspacefactory]::CreateRunspace()
  $rs.ApartmentState = [System.Threading.ApartmentState]::STA
  $rs.ThreadOptions = 'ReuseThread'
  $rs.Open()
  $ps = [powershell]::Create()
  $ps.Runspace = $rs
  $null = $ps.AddScript($dialogScript)
  try {
    $out = $ps.Invoke()
    if ($out.Count -gt 0) { $out[0] }
  } finally {
    $ps.Dispose()
    $rs.Dispose()
  }
}
