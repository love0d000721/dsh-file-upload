// Host-half behavioral tests: spawn-free discovery, one-shot execution with
// per-candidate fallback, and the RPC handlers, driven through fake subprocess.

import { readBody, loadHostPlugin, fakeCtx, fakeHarness, fakeSubprocess, fakeHandle } from './helpers.mjs'

export const name = 'host (discovery + one-shot + handlers)'

const ALIAS = 'C:\\Users\\tester\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe'
const MSI = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
const PS51 = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const CMD = 'C:\\Windows\\System32\\cmd.exe'

function resolveFor({ alias = true, ps51 = true } = {}) {
  const map = {
    [MSI]: undefined,
    pwsh: undefined,
    'C:\\ProgramData\\chocolatey\\bin\\pwsh.exe': undefined,
    [PS51]: ps51 ? PS51 : undefined,
  }
  if (alias) map[ALIAS] = ALIAS
  return map
}

// spawnImpl scenarios:
//   - cmd spawn (where/echo) → collect stdout with the configured text.
//   - pwsh one-shot spawn (argv[4] === '-Command', collect stdout):
//       * if failPaths includes argv[0] → exit non-zero (simulates a path that
//         resolves but cannot run).
//       * otherwise → the pick/copy JSON result.
function makeSpawn({ whereOut = `${ALIAS}\n`, localAppDataOut = 'C:\\Users\\tester\\AppData\\Local', failPaths = [], pickOut = null, copyOut = null } = {}) {
  return (spec) => {
    const argv0 = spec.argv[0]
    if (argv0 === CMD) {
      const cmdline = spec.argv[3] || ''
      const text = cmdline.includes('where pwsh') ? whereOut : cmdline.includes('%LOCALAPPDATA%') ? localAppDataOut : ''
      const h = fakeHandle({ stdoutText: text, exitCode: 0 })
      h.settle()
      return h
    }
    const isScript = spec.argv[4] === '-Command' && spec.stdio.stdout && typeof spec.stdio.stdout === 'object'
    if (isScript) {
      const isPick = /ShowDialog/.test(spec.argv[5] || '')
      const text = isPick ? ((pickOut || '{"cancelled":false,"paths":["D:\\\\x\\\\a.txt"]}') + '\n')
        : ((copyOut || '[{"source":"D:\\\\x\\\\a.txt","ok":true,"error":null,"dest":"D:\\\\WS\\\\uploads\\\\a.txt"}]') + '\n')
      const h = fakeHandle({ stdoutText: text, exitCode: failPaths.includes(argv0) ? 1 : 0 })
      h.settle()
      return h
    }
    throw new Error('unexpected spawn: ' + JSON.stringify(spec.argv))
  }
}

async function boot({ resolve, spawnImpl }) {
  const ctx = fakeCtx({ services: { subprocess: fakeSubprocess({ resolve, spawnImpl }), sandboxPolicy: { workspaceRoot: 'D:\\WS' } } })
  const harness = fakeHarness()
  const body = await readBody('src/host/body.js')
  const plugin = await loadHostPlugin(body, { ctx, harness, console })
  if (!plugin || typeof plugin.apply !== 'function') throw new Error('host body did not return a plugin')
  plugin.apply(ctx)
  return { ctx, harness }
}

export const tests = [
  {
    name: 'pick-files returns picked paths via one-shot spawn',
    async fn() {
      const { harness } = await boot({ resolve: resolveFor(), spawnImpl: makeSpawn() })
      const res = await harness.handlers['pick-files']()
      if (!res || res.cancelled) throw new Error('expected picked files, got ' + JSON.stringify(res))
      if (res.paths[0] !== 'D:\\x\\a.txt') throw new Error('wrong paths: ' + JSON.stringify(res.paths))
      if (res.workspaceRoot !== 'D:\\WS') throw new Error('workspaceRoot missing')
      if (res.destRoot !== 'D:\\WS\\uploads') throw new Error('destRoot missing')
      if (res.engine !== 'pwsh7') throw new Error('engine should be pwsh7, got ' + res.engine)
    },
  },
  {
    name: 'pick-files cancellation is forwarded',
    async fn() {
      const { harness } = await boot({ resolve: resolveFor(), spawnImpl: makeSpawn({ pickOut: '{"cancelled":true,"paths":[]}' }) })
      const res = await harness.handlers['pick-files']()
      if (!res || res.cancelled !== true) throw new Error('expected cancellation, got ' + JSON.stringify(res))
    },
  },
  {
    name: 'upload-files returns safe results with basename',
    async fn() {
      const { harness } = await boot({ resolve: resolveFor(), spawnImpl: makeSpawn() })
      const res = await harness.handlers['upload-files']({ paths: ['D:\\x\\a.txt'] })
      if (res.error) throw new Error('unexpected error: ' + res.error)
      if (!Array.isArray(res.results) || res.results.length !== 1) throw new Error('expected one result')
      const r = res.results[0]
      if (r.ok !== true) throw new Error('expected ok')
      if (r.basename !== 'a.txt') throw new Error('basename missing: ' + JSON.stringify(r))
      if (r.dest !== 'D:\\WS\\uploads\\a.txt') throw new Error('dest missing')
    },
  },
  {
    name: 'a path that resolves but cannot run falls through to the next candidate',
    async fn() {
      // ALIAS resolves first but its spawn exits non-zero → the ps51 path runs.
      const { harness } = await boot({
        resolve: resolveFor(),
        spawnImpl: makeSpawn({ failPaths: [ALIAS] }),
      })
      const res = await harness.handlers['pick-files']()
      if (!res || res.error) throw new Error('expected a successful fallback, got ' + JSON.stringify(res))
      if (res.paths[0] !== 'D:\\x\\a.txt') throw new Error('fallback spawn did not run')
      if (res.engine !== 'ps51') throw new Error('expected engine from the fallback path (ps51), got ' + res.engine)
    },
  },
  {
    name: 'resolves to Windows PowerShell 5.1 when pwsh 7 is absent',
    async fn() {
      const { harness } = await boot({
        resolve: resolveFor({ alias: false }),
        spawnImpl: makeSpawn({ whereOut: '', localAppDataOut: '' }),
      })
      const res = await harness.handlers['pick-files']()
      if (!res) throw new Error('no response')
      if (res.engine !== 'ps51') throw new Error('expected ps51 fallback, got ' + JSON.stringify(res))
      if (res.error) throw new Error('error: ' + res.error)
    },
  },
  {
    name: 'reports a clear error when no PowerShell exists at all',
    async fn() {
      const { harness } = await boot({
        resolve: resolveFor({ alias: false, ps51: false }),
        spawnImpl: makeSpawn({ whereOut: '', localAppDataOut: '' }),
      })
      const res = await harness.handlers['pick-files']()
      if (!res || !res.error) throw new Error('expected an error, got ' + JSON.stringify(res))
      if (!res.error.includes('PowerShell')) throw new Error('error should mention PowerShell: ' + res.error)
    },
  },
  {
    name: 'upload-files rejects empty path lists without spawning',
    async fn() {
      const { harness } = await boot({ resolve: resolveFor(), spawnImpl: makeSpawn() })
      const res = await harness.handlers['upload-files']({ paths: [] })
      if (!res || !res.error) throw new Error('expected error for empty paths')
    },
  },
]
