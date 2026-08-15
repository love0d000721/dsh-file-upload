// Drift guard: the PowerShell scripts embedded in src/host/body.js must match
// the canonical assets/*.ps1 files. Edit the .ps1 files, then mirror the
// change into the body (or run `node tests/drift.test.mjs` to see the diff).

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ROOT, readBody } from './helpers.mjs'

export const name = 'drift (host body vs assets/*.ps1)'

function extract(body, constName) {
  const re = new RegExp('const ' + constName + ' = `([\\s\\S]*?)`\\.trim\\(\\)')
  const m = body.match(re)
  if (!m) throw new Error('could not locate `const ' + constName + '` in src/host/body.js')
  return m[1].trim()
}

function normalize(s) {
  return s.replace(/\r\n/g, '\n').trim()
}

export const tests = [
  {
    name: 'PICK_PS1 matches assets/pick.ps1',
    async fn() {
      const [body, asset] = await Promise.all([readBody('src/host/body.js'), readFile(path.join(ROOT, 'assets', 'pick.ps1'), 'utf8')])
      const embedded = normalize(extract(body, 'PICK_PS1'))
      const canonical = normalize(asset)
      if (embedded !== canonical) throw new Error('DRIFT in pick.ps1')
    },
  },
  {
    name: 'COPY_PS1 matches assets/copy.ps1',
    async fn() {
      const [body, asset] = await Promise.all([readBody('src/host/body.js'), readFile(path.join(ROOT, 'assets', 'copy.ps1'), 'utf8')])
      const embedded = normalize(extract(body, 'COPY_PS1'))
      const canonical = normalize(asset)
      if (embedded !== canonical) throw new Error('DRIFT in copy.ps1')
    },
  },
  {
    name: 'bodies are plain JS (no import/export at top level)',
    async fn() {
      for (const rel of ['src/host/body.js', 'src/client/body.js']) {
        const text = await readBody(rel)
        if (/^\s*(import|export)\s/m.test(text)) {
          throw new Error(`${rel} contains top-level import/export; dynamic loading requires a plain body`)
        }
      }
    },
  },
]
