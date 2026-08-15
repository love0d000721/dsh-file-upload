// Regenerates the embedded PowerShell copies inside src/host/body.js from the
// canonical assets/*.ps1 files. Usage: node scripts/sync-assets.mjs
// After editing an assets/*.ps1, run this (or `npm run sync:assets`) so the
// drift test (tests/drift.test.mjs) stays green.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BODY = path.join(ROOT, 'src', 'host', 'body.js')

const pairs = [
  ['PICK_PS1', 'pick.ps1'],
  ['COPY_PS1', 'copy.ps1'],
]

let body = readFileSync(BODY, 'utf8')

for (const [constName, assetName] of pairs) {
  const content = readFileSync(path.join(ROOT, 'assets', assetName), 'utf8').trim()
  const re = new RegExp('const ' + constName + ' = `[\\s\\S]*?`\\.trim\\(\\)')
  if (!re.test(body)) throw new Error('could not locate `const ' + constName + '` in src/host/body.js')
  body = body.replace(re, 'const ' + constName + ' = `\n' + content + '\n`.trim()')
}

writeFileSync(BODY, body)
console.log('synced ' + pairs.length + ' embedded scripts from assets/*.ps1')
