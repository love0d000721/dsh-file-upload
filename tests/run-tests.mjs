// dsh-file-upload — zero-dependency test runner.
// Usage: node tests/run-tests.mjs [test-file...]
// Each test file exports `tests = [{ name, fn }]`; `fn` throws on failure.

import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const specific = process.argv.slice(2)
const files = specific.length > 0
  ? specific.map((f) => (f.endsWith('.mjs') ? f : f + '.mjs'))
  : readdirSync(HERE).filter((f) => f.endsWith('.test.mjs')).sort()

let passCount = 0
let failCount = 0
const failures = []

for (const file of files) {
  const mod = await import(pathToFileURL(path.join(HERE, file)).href)
  const suiteName = mod.name || file
  const suite = mod.tests || []
  console.log(`\n=== ${suiteName} ===`)
  for (const test of suite) {
    try {
      await test.fn()
      passCount += 1
      console.log(`  ✓ ${test.name}`)
    } catch (err) {
      failCount += 1
      failures.push({ suite: suiteName, name: test.name, error: err })
      console.log(`  ✗ ${test.name}\n    ${String(err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n    ') : err)}`)
    }
  }
}

console.log(`\n${passCount} passed, ${failCount} failed`)
if (failCount > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - [${f.suite}] ${f.name}: ${f.error && f.error.message}`)
  process.exit(1)
}
