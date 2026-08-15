// Client-half pure-logic tests: i18n, privacy-safe insertion, path helpers,
// hotkey combinators. The __u helpers are captured through the test hook.

import { readBody, loadClientPlugin, fakeReact } from './helpers.mjs'

export const name = 'client (i18n + privacy + hotkeys)'

let helpers
const noop = () => {}

async function load() {
  if (helpers) return helpers
  const body = await readBody('src/client/body.js')
  const { plugin, helpers: u } = await loadClientPlugin(body, {
    React: fakeReact,
    console,
    styles: { insert: noop },
    host: { call: noop },
    harness: undefined,
  })
  if (!u) throw new Error('test hook did not capture __u (did the body structure change?)')
  if (!plugin || typeof plugin.apply !== 'function') throw new Error('client body did not return a plugin')
  helpers = u
  return u
}

export const tests = [
  {
    name: 'i18n: zh and en dictionaries both resolve; fallback to zh',
    async fn() {
      const u = await load()
      if (!u.t('zh', 'modalTitle', { n: 3 }).includes('3')) throw new Error('zh modalTitle')
      if (u.t('en', 'modalTitle', { n: 3 }).includes('3') === false) throw new Error('en modalTitle')
      if (u.t('xx', 'cancel') !== u.t('zh', 'cancel')) throw new Error('zh fallback failed')
    },
  },
  {
    name: 'PRIVACY: default insertion never contains absolute paths',
    async fn() {
      const u = await load()
      const root = 'D:/WS'
      const paths = ['D:/WS/uploads/a.txt', 'C:/Users/someone/Secret/keys.txt']
      const text = u.buildInsertText(paths, root, false, 'zh')
      if (text.includes('D:/WS/uploads/a.txt')) throw new Error('workspace-relative path should not appear as absolute')
      if (text.includes('C:/Users/someone')) throw new Error('absolute path leaked into safe text: ' + text)
      if (!text.includes('uploads/a.txt')) throw new Error('expected workspace-relative path in text')
      if (!text.includes('keys.txt')) throw new Error('expected basename for outside-workspace file')
    },
  },
  {
    name: 'PRIVACY: opt-in absolute mode includes full paths',
    async fn() {
      const u = await load()
      const text = u.buildInsertText(['C:/Users/someone/Secret/keys.txt'], 'D:/WS', true, 'zh')
      if (!text.includes('C:/Users/someone/Secret/keys.txt')) throw new Error('absolute path missing when opted in')
    },
  },
  {
    name: 'path helpers: isUnderWorkspace / workspaceRelative / basename',
    async fn() {
      const u = await load()
      if (!u.isUnderWorkspace('D:\\WS\\uploads\\a.txt', 'D:\\WS')) throw new Error('backslash under workspace')
      if (u.isUnderWorkspace('C:\\Elsewhere\\a.txt', 'D:\\WS')) throw new Error('outside marked under')
      if (u.workspaceRelative('D:\\WS\\uploads\\a.txt', 'D:\\WS') !== 'uploads/a.txt') throw new Error('relative mapping')
      if (u.workspaceRelative('C:\\Elsewhere\\a.txt', 'D:\\WS') !== null) throw new Error('outside should be null')
      if (u.basename('C:\\a\\b\\c.txt') !== 'c.txt') throw new Error('basename windows')
      if (u.basename('/a/b/c.txt') !== 'c.txt') throw new Error('basename posix')
    },
  },
  {
    name: 'hotkey combinators: record, label, match',
    async fn() {
      const u = await load()
      const combo = u.comboFromEvent({ ctrlKey: true, shiftKey: true, key: 'U' })
      if (combo !== 'ctrl+shift+u') throw new Error('comboFromEvent: ' + combo)
      if (u.comboFromEvent({ key: 'Control' }) !== null) throw new Error('modifier-only should be null')
      if (u.comboLabel('ctrl+shift+u') !== 'Ctrl+Shift+U') throw new Error('comboLabel')
      if (!u.matchesHotkey({ ctrlKey: true, shiftKey: true, key: 'u' }, 'ctrl+shift+u')) throw new Error('match')
      if (u.matchesHotkey({ ctrlKey: true, key: 'u' }, 'ctrl+shift+u')) throw new Error('wrong combo matched')
    },
  },
  {
    name: 'client plugin declares slots injection and apply',
    async fn() {
      const body = await readBody('src/client/body.js')
      const { plugin } = await loadClientPlugin(body, {
        React: fakeReact,
        console,
        styles: { insert: noop },
        host: { call: noop },
        harness: undefined,
      })
      if (!Array.isArray(plugin.inject) || !plugin.inject.includes('slots')) throw new Error('missing slots inject')
    },
  },
]
