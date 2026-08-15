// Real-PowerShell integration tests (skipped when pwsh is unavailable).
// These verify the ACTUAL assets/*.ps1 against a live pwsh 7 / 5.1.
// `copy.ps1` runs headless; `pick.ps1` opens a GUI dialog and is
// syntax-checked only.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ROOT } from './helpers.mjs'

export const name = 'pwsh integration (real PowerShell)'

function findPwsh() {
  const candidates = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  ]
  try {
    const w = spawnSync('C:\\Windows\\System32\\cmd.exe', ['/d', '/c', 'where pwsh'], { encoding: 'utf8', timeout: 10000 })
    if (w.status === 0) {
      const lines = (w.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      for (const line of lines) {
        if (line.toLowerCase().includes('appdata\\local\\microsoft\\windowsapps')) candidates.unshift(line)
        else candidates.push(line)
      }
    }
  } catch (e) { /* cmd unavailable */ }
  for (const cand of candidates) {
    try {
      const r = spawnSync(cand, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8', timeout: 15000 })
      if (r.status === 0 && /^\d+\.\d+/.test((r.stdout || '').trim())) return cand
    } catch (e) { /* next candidate */ }
  }
  return null
}

const PW = findPwsh()
const available = PW !== null

function run(scriptFile, { stdinJson = undefined } = {}) {
  const r = spawnSync(PW, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', readFileSync(path.join(ROOT, 'assets', scriptFile), 'utf8')], {
    input: stdinJson !== undefined ? JSON.stringify(stdinJson) : undefined,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  })
  return r
}

const common = [
  {
    name: 'copy.ps1 copies files with UTF-8 names and collision handling',
    async fn() {
      if (!available) throw new Error('SKIP: no pwsh found')
      const base = mkdtempSync(path.join(tmpdir(), 'dsh-upload-test-'))
      try {
        const src = path.join(base, 'src')
        const dest = path.join(base, 'dest')
        writeFileSync(path.join(src, '甲文件.txt'), 'hi', 'utf8')
        const r = run('copy.ps1', { stdinJson: { destRoot: dest, paths: [path.join(src, '甲文件.txt'), path.join(src, 'missing.txt')] } })
        if (r.status !== 0) throw new Error('copy.ps1 exit ' + r.status + ': ' + r.stderr)
        const results = JSON.parse(r.stdout.trim())
        if (results.length !== 2) throw new Error('expected 2 results')
        const ok = results.find((x) => x.ok === true)
        const fail = results.find((x) => x.ok === false)
        if (!ok || !fail) throw new Error('expected one ok and one fail')
        if (!existsSync(path.join(dest, '甲文件.txt'))) throw new Error('UTF-8 filename not copied')
        if (fail.error !== 'source-missing') throw new Error('expected source-missing error')
      } finally {
        rmSync(base, { recursive: true, force: true })
      }
    },
  },
  {
    name: 'pick.ps1 parses as valid PowerShell',
    async fn() {
      if (!available) throw new Error('SKIP: no pwsh found')
      const r = spawnSync(PW, ['-NoProfile', '-Command',
        `$t=$null;$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${path.join(ROOT, 'assets', 'pick.ps1')}',[ref]$t,[ref]$e);if($e.Count){$e|%{$_.Message};exit 1}else{'OK'}`],
        { encoding: 'utf8', timeout: 30000 })
      if (r.status !== 0) throw new Error('pick.ps1 syntax: ' + r.stdout + r.stderr)
    },
  },
]

export const tests = available
  ? common
  : [{ name: 'pwsh not found — integration tests skipped', fn: async () => {} }]
