// Test helpers: load the plugin bodies the way the dynamic runners do, and
// provide small fakes for ctx / harness / subprocess / React / host.

import { readFile } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function readBody(rel) {
  return readFile(path.join(ROOT, rel), 'utf8')
}

/** Mirror of the dynamic HOST runner's closure: ctx, harness, console, btoa, atob, TextEncoder, TextDecoder. */
export async function loadHostPlugin(bodyText, deps) {
  const factory = new Function(
    'ctx', 'harness', 'console', 'btoa', 'atob', 'TextEncoder', 'TextDecoder',
    `return (async () => {\n${bodyText}\n})()`,
  )
  return factory(deps.ctx, deps.harness, deps.console, (s) => btoa(s), atob, TextEncoder, TextDecoder)
}

/** Mirror of the dynamic CLIENT runner's closure. Captures the pure __u helpers via a test hook. */
export async function loadClientPlugin(bodyText, deps) {
  const hooked = bodyText.replace(/^return \{/m, (m) =>
    `if (globalThis && globalThis.__DSH_UPLOAD_HELPERS_HOOK__) globalThis.__DSH_UPLOAD_HELPERS_HOOK__(__u)\n${m}`)
  const factory = new Function(
    'React', 'console', 'styles', 'host', 'harness',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'require', 'process', 'Buffer',
    `return (async () => {\n${hooked}\n})()`,
  )
  let captured = null
  globalThis.__DSH_UPLOAD_HELPERS_HOOK__ = (u) => { captured = u }
  try {
    const plugin = await factory(
      deps.React, deps.console, deps.styles, deps.host, deps.harness,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    )
    return { plugin, helpers: captured }
  } finally {
    delete globalThis.__DSH_UPLOAD_HELPERS_HOOK__
  }
}

/** Minimal fake ctx: get() from a map, effect() captures callbacks, timeout() records. */
export function fakeCtx({ services = {}, runEffects = false, realTimers = false } = {}) {
  const effects = []
  const timeouts = []
  return {
    effects,
    timeouts,
    get(name) { return services[name] },
    effect(callback) {
      effects.push(callback)
      if (runEffects) {
        const disposer = callback()
        return disposer || (() => {})
      }
      return () => {}
    },
    timeout(fn, ms) {
      if (realTimers) return setTimeout(() => fn(), ms)
      timeouts.push({ fn, ms })
      return () => {}
    },
    interval(fn, ms) {
      if (realTimers) return setInterval(() => fn(), ms)
      timeouts.push({ fn, ms, interval: true })
      return () => {}
    },
  }
}

/** Fake harness: records handle() registrations. */
export function fakeHarness() {
  const handlers = {}
  return {
    handlers,
    handle(method, fn) { handlers[method] = fn },
  }
}

/** Fake subprocess: configurable resolveExecutable + programmable spawn. */
export function fakeSubprocess({ resolve = {}, spawnImpl } = {}) {
  const spawns = []
  return {
    spawns,
    async resolveExecutable(command) {
      if (typeof resolve === 'function') return resolve(command)
      if (Object.prototype.hasOwnProperty.call(resolve, command) && resolve[command] !== undefined) {
        return resolve[command]
      }
      const err = new Error('not found on PATH: ' + command)
      err.code = 'ENOENT'
      throw err
    },
    spawn(spec) {
      const handle = spawnImpl ? spawnImpl(spec, this) : null
      spawns.push({ spec, handle })
      return handle
    },
  }
}

/** A programmable subprocess handle. */
export function fakeHandle({ stdoutMode = 'collect', stdoutText = '', exitCode = 0, stderrText = '', fail = false } = {}) {
  const stdout = stdoutMode === 'pipe' ? new EventEmitter() : undefined
  const stdin = {
    write(chunk) { if (this.onWrite) this.onWrite(String(chunk)) },
    end() {},
  }
  let doneResolve
  const done = new Promise((resolve, reject) => {
    doneResolve = (v) => resolve(v)
  })
  const handle = {
    stdin,
    stdout,
    done,
    terminated: false,
    collected: {
      stdout: stdoutMode === 'collect' ? { readFrom() { return { text: stdoutText } } } : undefined,
      stderr: { readFrom() { return { text: stderrText } } },
    },
    terminate() { this.terminated = true },
    emitOut(text) { if (stdout) stdout.emit('data', Buffer.from(text)) },
    settle(result) { doneResolve(result || { exitCode, signal: null }) },
    fail(err) { /* no-op; caller may reject via separate path */ },
  }
  return handle
}

/** Fake React: records createElement calls (used to assert render structure). */
export const fakeReact = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children }
  },
  useState(initial) {
    return [initial, () => {}]
  },
  useEffect() {},
}
