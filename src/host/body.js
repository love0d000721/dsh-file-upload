// dsh-file-upload — HOST half (plain-JS dynamic-plugin body; no imports).
//
// Canonical host implementation, loadable three ways:
//   1. DYNAMIC  — paste/read this body into cordis_define code.host.
//   2. TEST     — tests/run-tests.mjs evals it in a Node sandbox with fake
//                 ctx/harness/subprocess and exercises the pure logic.
//   3. STATIC   — a future composition build can split it into modules; the
//                 RPC seam (harness.handle) is the only part to swap.
//
// ARCHITECTURE (kept deliberately simple — reliability first):
//   - Every pick/copy spawns ONE short-lived PowerShell process (the proven
//     one-shot path). No persistent server, no pipes, no background warm-up:
//     those made the pick hang in some environments and are gone.
//   - Engine discovery never spawns a probe process — it only resolves paths
//     (resolveExecutable / cmd `where`), so it cannot hang. The dialog spawn
//     itself is the probe: a bad path fails fast and the next candidate runs.
//   - Every await in a handler is wrapped in a hard timeout, so a wedged
//     process surfaces as an error instead of an endless "Selecting…".
//
// PRIVACY: this half never reads file contents and never scans directories.
// It returns file paths only to the package's own browser half over the
// loopback RPC. Nothing here sends data to any model or network.

return {
  inject: ['timer'],
  apply(ctx) {
    // ────────────────────────────────────────────────────────────────────
    // Section 1 — PowerShell scripts (canonical copies of assets/*.ps1)
    // ────────────────────────────────────────────────────────────────────

    const PICK_PS1 = `
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
`.trim()

    const COPY_PS1 = `
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
`.trim()

    // ────────────────────────────────────────────────────────────────────
    // Section 2 — engine discovery (spawn-free: path resolution only)
    // ────────────────────────────────────────────────────────────────────

    let pwshPathsCache = null

    function subprocess() {
      return ctx.get('subprocess')
    }

    function workspaceRoot() {
      const policy = ctx.get('sandboxPolicy')
      return policy && typeof policy.workspaceRoot === 'string' ? policy.workspaceRoot : null
    }

    async function runCmdCapture(commandLine) {
      const sp = subprocess()
      const root = workspaceRoot()
      if (!sp || !root) throw new Error('subprocess or workspace unavailable')
      const handle = sp.spawn({
        argv: ['C:\\Windows\\System32\\cmd.exe', '/d', '/c', commandLine],
        cwd: root,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } },
        graceMs: 15000,
      })
      const outcome = await handle.done
      const stdout = handle.collected && handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const stderr = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      if (outcome.exitCode !== 0) {
        throw new Error('cmd failed (' + outcome.exitCode + '): ' + commandLine + (stderr.trim() ? ' — ' + stderr.trim().slice(0, 300) : ''))
      }
      return stdout
    }

    // Candidate PowerShell paths, best first. NO probe processes are spawned —
    // resolution is stat/PATH lookups plus `where pwsh` output, so this cannot
    // hang. A path that resolves but cannot run is caught by the dialog spawn
    // itself, and runPwsh falls through to the next candidate.
    async function resolvePwshPaths() {
      if (pwshPathsCache) return pwshPathsCache
      const sp = subprocess()
      if (sp === undefined) throw new Error('subprocess service unavailable')
      const paths = []
      const tryAdd = async (promise) => {
        try {
          const p = await promise
          if (typeof p === 'string' && p.length > 0 && !paths.includes(p)) paths.push(p)
        } catch (e) { /* candidate not present */ }
      }
      await tryAdd(sp.resolveExecutable('C:\\Program Files\\PowerShell\\7\\pwsh.exe'))
      await tryAdd(sp.resolveExecutable('pwsh'))
      let localAppData = ''
      try {
        localAppData = (await runCmdCapture('echo %LOCALAPPDATA%')).split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0) || ''
      } catch (e) { /* no cmd */ }
      if (localAppData) {
        await tryAdd(sp.resolveExecutable(localAppData + '\\Microsoft\\WindowsApps\\pwsh.exe'))
      }
      try {
        const whereOut = await runCmdCapture('where pwsh')
        for (const line of whereOut.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 0)) {
          // The Store package exe under Program Files\WindowsApps cannot be
          // launched directly; the user alias under AppData can.
          if (/Program Files\\WindowsApps/i.test(line)) continue
          await tryAdd(sp.resolveExecutable(line))
        }
      } catch (e) { /* no where */ }
      await tryAdd(sp.resolveExecutable('C:\\ProgramData\\chocolatey\\bin\\pwsh.exe'))
      await tryAdd(sp.resolveExecutable('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'))
      if (paths.length === 0) {
        throw new Error('No usable PowerShell found (pwsh 7 or Windows PowerShell 5.1). Install PowerShell 7: https://github.com/PowerShell/PowerShell/releases')
      }
      pwshPathsCache = paths
      return paths
    }

    function engineOf(path) {
      return String(path).toLowerCase().endsWith('powershell.exe') ? 'ps51' : 'pwsh7'
    }

    // ────────────────────────────────────────────────────────────────────
    // Section 3 — one-shot spawn + hard timeouts
    // ────────────────────────────────────────────────────────────────────

    // Every handler await is bounded: a wedged process becomes an error, never
    // an endless "Selecting…".
    function withTimeout(promise, timeoutMs, message) {
      return new Promise((resolve, reject) => {
        let settled = false
        const timer = ctx.timeout(() => {
          if (settled) return
          settled = true
          reject(new Error(message))
        }, timeoutMs)
        promise.then(
          (v) => { if (!settled) { settled = true; try { timer() } catch (e) {}; resolve(v) } },
          (e) => { if (!settled) { settled = true; try { timer() } catch (e) {}; reject(e) } },
        )
      })
    }

    // Spawn ONE short-lived PowerShell process for `script` and collect stdout.
    // Tries each resolved candidate until one actually runs (the first spawn
    // that neither fails at spawn-time nor exits non-zero wins).
    async function runPwsh(script, stdinData) {
      const sp = subprocess()
      if (sp === undefined) throw new Error('subprocess service unavailable')
      const root = workspaceRoot()
      if (!root) throw new Error('workspace root unavailable')
      const paths = await resolvePwshPaths()
      let lastError = null
      for (const path of paths) {
        let handle
        try {
          handle = sp.spawn({
            argv: [path, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
            cwd: root,
            stdio: {
              stdin: stdinData === undefined ? 'ignore' : { data: stdinData },
              stdout: { maxBytes: 2 * 1024 * 1024 },
              stderr: { maxBytes: 2 * 1024 * 1024 },
            },
            graceMs: 60000,
          })
          const outcome = await handle.done
          const stdout = handle.collected && handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
          const stderr = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
          if (outcome.exitCode !== 0) {
            const detail = stderr.trim()
            throw new Error('PowerShell exit ' + outcome.exitCode + (detail ? ': ' + detail.slice(0, 400) : ''))
          }
          return { stdout, engine: engineOf(path) }
        } catch (err) {
          if (handle && !handle.terminated) { try { handle.terminate() } catch (e) {} }
          lastError = err
        }
      }
      throw lastError || new Error('no usable PowerShell')
    }

    // ────────────────────────────────────────────────────────────────────
    // Section 4 — RPC handlers (browser half calls these via host.call)
    // ────────────────────────────────────────────────────────────────────

    harness.handle('pick-files', async () => {
      try {
        const root = workspaceRoot()
        if (!root) return { error: 'workspace root unavailable' }
        const destRoot = root + '\\uploads'
        // Resolve the engine with a 20s cap (resolution is spawn-free, so a
        // timeout here means the subprocess service itself is wedged).
        const resolved = await withTimeout(resolvePwshPaths(), 20000, 'PowerShell 定位超时（subprocess 服务无响应）')
        // The dialog may stay open as long as the user wants; the 10-minute cap
        // only guards against a spawn that never shows a dialog.
        const { stdout, engine } = await withTimeout(runPwsh(PICK_PS1), 600000, '文件对话框进程无响应（10 分钟超时）')
        const text = stdout.trim()
        if (!text) return { cancelled: true, paths: [], destRoot, workspaceRoot: root, engine }
        const data = JSON.parse(text)
        return {
          cancelled: data.cancelled === true,
          paths: Array.isArray(data.paths) ? data.paths.filter((p) => typeof p === 'string') : [],
          destRoot,
          workspaceRoot: root,
          engine,
        }
      } catch (err) {
        return { error: 'open dialog failed: ' + String(err && err.message ? err.message : err) }
      }
    })

    harness.handle('upload-files', async (args) => {
      try {
        const paths = args && Array.isArray(args.paths) ? args.paths.filter((p) => typeof p === 'string' && p.length > 0) : []
        if (paths.length === 0) return { error: 'no files to copy' }
        const root = workspaceRoot()
        if (!root) return { error: 'workspace root unavailable' }
        const destRoot = root + '\\uploads'
        const payload = JSON.stringify({ destRoot, paths })
        const { stdout } = await withTimeout(runPwsh(COPY_PS1, payload), 60000, '复制进程无响应（60 秒超时）')
        if (stdout.startsWith('ERR ')) return { error: stdout.slice(4) }
        const text = stdout.trim()
        if (!text) return { error: 'copy script returned no result' }
        const results = JSON.parse(text)
        const safe = (Array.isArray(results) ? results : []).map((r) => ({
          source: typeof r.source === 'string' ? r.source : '',
          basename: typeof r.source === 'string' ? r.source.split(/[\\/]/).pop() : '',
          ok: r.ok === true,
          error: typeof r.error === 'string' ? r.error : null,
          dest: typeof r.dest === 'string' ? r.dest : null,
        }))
        return { results: safe, destRoot }
      } catch (err) {
        return { error: 'copy failed: ' + String(err && err.message ? err.message : err) }
      }
    })
  },
}
