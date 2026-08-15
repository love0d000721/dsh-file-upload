// dsh-file-upload — CLIENT half (plain-JS dynamic-plugin body; no imports).
//
// Canonical browser implementation, loadable three ways:
//   1. DYNAMIC  — paste/read this body into cordis_define code.client.
//   2. TEST     — tests/run-tests.mjs evals it with a fake React/host/store;
//                 the pure helpers in __u are captured through a test hook.
//   3. STATIC   — a future composition build can split it into modules; the
//                 RPC seam (host.call) is the only part to swap.
//
// PRIVACY (defaults are safe):
//   - The modal lists FILE NAMES only; full paths need an explicit reveal.
//   - Text inserted into the composer never contains absolute paths unless
//     the user opts in (setting "insertAbsolutePaths", default OFF) and sees
//     an in-modal warning. Otherwise it uses workspace-relative paths when
//     the file was copied into the workspace, and bare names otherwise.
//   - No file content is ever read or transmitted.

// ──────────────────────────────────────────────────────────────────────
// Pure helpers (top-level so tests can capture them; no ctx/state access)
// ──────────────────────────────────────────────────────────────────────

const I18N = {
  zh: {
    triggerTitle: '通过 Windows 资源管理器选择文件上传（快捷键 {hotkey}）',
    triggerSelecting: '选择中…',
    triggerUpload: '📁 上传',
    modalTitle: '上传文件（{n} 个）',
    modeWorkspace: '复制到工作区',
    modeWorkspaceDesc: '复制进工作区 uploads 目录，agent 可直接读写',
    modeInput: '插入路径到输入框',
    modeInputDesc: '不复制文件，以安全格式列出文件',
    modeBoth: '两者都要',
    modeBothDesc: '复制到工作区，同时在输入框附上路径清单',
    destRoot: '复制目标：{path}',
    engine51: '⚠️ 当前使用 Windows PowerShell 5.1（系统自带）。建议安装 PowerShell 7 以获得最佳体验。',
    absPathWarn: '⚠️ 已开启「插入完整绝对路径」：完整路径将插入输入框并随消息发送给模型。',
    outsideWarn: '注意：以下文件在工作区之外，agent 无法直接读取；将以文件名列出。',
    showFullPaths: '显示完整路径',
    hideFullPaths: '隐藏完整路径',
    cancel: '取消',
    confirm: '确认上传',
    working: '正在处理…',
    copiedSummary: '已复制 {ok} / {total} 个文件到工作区',
    copiedSummaryFail: '（{n} 个失败）',
    alsoInserted: '；并已插入路径到输入框',
    insertedSummary: '已将 {n} 条路径插入输入框',
    done: '完成',
    error: '出错了：{msg}',
    close: '关闭',
    insertHeader: '我通过 Windows 资源管理器选择了以下文件，请处理：',
    insertAbsNote: '（完整绝对路径）',
    insertSafeNote: '（工作区相对路径 / 文件名，保护本地目录结构）',
    hotkeyLabel: '文件上传快捷键',
    hotkeyHint: '点击右侧按键，清除后按下新组合键即可录制',
    hotkeyHintRecording: '请按下新的快捷键组合（Esc 取消）',
    hotkeyRecording: '按下新快捷键…',
    langLabel: '界面语言',
    langZh: '中文',
    langEn: 'English',
    privacyLabel: '插入完整绝对路径',
    privacyHint: '关闭时仅插入工作区相对路径或文件名，避免向模型泄露本地目录结构',
    privacyOn: '开',
    privacyOff: '关',
    sourceMissing: '源文件不存在',
    sectionLabel: '文件上传',
    privacySection: '隐私设置',
    privacyExplain: '默认已保护隐私：文件列表默认只显示文件名；插入输入框的内容不含完整本地路径。以下选项可自行调整，改动立即生效。',
    showFullSetting: '文件列表显示完整路径',
    showFullHint: '开启后选择弹窗直接显示完整路径；关闭时仅显示文件名（可在弹窗内临时展开）',
    noticeCopy: '上传说明：将把 {n} 个文件复制到 {path}，复制后 agent 可在工作区内直接读取。',
    noticeInsert: '上传说明：文件路径将插入输入框，随下一条消息发送给模型。当前完整路径模式：{mode}。',
    noticeInsertOn: '开（完整绝对路径将随消息发送）',
    noticeInsertOff: '关（仅工作区相对路径或文件名）',
  },
  en: {
    triggerTitle: 'Select files via Windows Explorer and upload (hotkey {hotkey})',
    triggerSelecting: 'Selecting…',
    triggerUpload: '📁 Upload',
    modalTitle: 'Upload files ({n})',
    modeWorkspace: 'Copy to workspace',
    modeWorkspaceDesc: 'Copy into workspace uploads dir; the agent can read them',
    modeInput: 'Insert paths into input',
    modeInputDesc: 'No copy; list files in a safe format',
    modeBoth: 'Both',
    modeBothDesc: 'Copy to workspace and list paths in the input',
    destRoot: 'Destination: {path}',
    engine51: '⚠️ Using Windows PowerShell 5.1 (built-in). Install PowerShell 7 for the best experience.',
    absPathWarn: '⚠️ "Insert absolute paths" is ON: absolute paths will be inserted and sent with your message to the model.',
    outsideWarn: 'Note: some files are outside the workspace; the agent cannot read them, so only their names are listed.',
    showFullPaths: 'Show full paths',
    hideFullPaths: 'Hide full paths',
    cancel: 'Cancel',
    confirm: 'Upload',
    working: 'Working…',
    copiedSummary: 'Copied {ok} / {total} files to workspace',
    copiedSummaryFail: ' ({n} failed)',
    alsoInserted: '; paths inserted into input',
    insertedSummary: 'Inserted {n} entries into the input',
    done: 'Done',
    error: 'Error: {msg}',
    close: 'Close',
    insertHeader: 'I selected the following files via Windows Explorer, please handle them:',
    insertAbsNote: ' (absolute paths)',
    insertSafeNote: ' (workspace-relative paths / names; protects your local directory layout)',
    hotkeyLabel: 'File upload hotkey',
    hotkeyHint: 'Click the key below, then press a new combination to record it',
    hotkeyHintRecording: 'Press a new key combination (Esc to cancel)',
    hotkeyRecording: 'Press new hotkey…',
    langLabel: 'UI language',
    langZh: '中文',
    langEn: 'English',
    privacyLabel: 'Insert absolute paths',
    privacyHint: 'When OFF, only workspace-relative paths or file names are inserted, hiding your local directory layout from the model',
    privacyOn: 'ON',
    privacyOff: 'OFF',
    sourceMissing: 'source file missing',
    sectionLabel: 'File Upload',
    privacySection: 'Privacy',
    privacyExplain: 'Privacy is protected by default: the file list shows names only, and inserted text never contains absolute local paths. Adjust the options below; changes apply immediately.',
    showFullSetting: 'Show full paths in file list',
    showFullHint: 'When ON the picker shows full paths directly; when OFF it shows names only (expandable per pick)',
    noticeCopy: 'Upload note: {n} file(s) will be copied to {path}; the agent can then read them inside the workspace.',
    noticeInsert: 'Upload note: file paths will be inserted into the input and sent with your next message. Absolute-path mode: {mode}.',
    noticeInsertOn: 'ON (absolute paths will be sent)',
    noticeInsertOff: 'OFF (workspace-relative paths or names only)',
  },
}

const __u = {
  t(lang, key, vars) {
    let s = I18N[lang] && I18N[lang][key]
    if (s === undefined) s = I18N.zh[key]
    if (s === undefined) s = key
    if (vars) {
      for (const k of Object.keys(vars)) s = String(s).replace('{' + k + '}', String(vars[k]))
    }
    return s
  },
  isUnderWorkspace(p, root) {
    if (!root || typeof p !== 'string') return false
    const pn = p.replace(/\\/g, '/').toLowerCase()
    const rn = root.replace(/\\/g, '/').toLowerCase()
    return pn.startsWith(rn)
  },
  workspaceRelative(p, root) {
    if (!this.isUnderWorkspace(p, root)) return null
    const rest = p.replace(/\\/g, '/').slice(root.length).replace(/^\/+/, '')
    return rest || null
  },
  basename(p) {
    if (typeof p !== 'string') return ''
    return p.split(/[\\/]/).pop()
  },
  buildInsertText(paths, workspaceRoot, absAllowed, lang) {
    const lines = [this.t(lang, 'insertHeader')]
    for (const p of paths) {
      if (absAllowed) lines.push(String(p))
      else {
        const rel = this.workspaceRelative(p, workspaceRoot)
        lines.push(rel || this.basename(p))
      }
    }
    lines.push(absAllowed ? this.t(lang, 'insertAbsNote') : this.t(lang, 'insertSafeNote'))
    return lines.join('\n')
  },
  comboFromEvent(e) {
    const parts = []
    if (e.ctrlKey) parts.push('ctrl')
    if (e.altKey) parts.push('alt')
    if (e.shiftKey) parts.push('shift')
    if (e.metaKey) parts.push('meta')
    const key = e.key
    if (typeof key !== 'string' || key.length === 0) return null
    const k = key.toLowerCase()
    if (k === 'control' || k === 'shift' || k === 'alt' || k === 'meta') return null
    parts.push(k)
    return parts.join('+')
  },
  comboLabel(combo) {
    if (!combo) return ''
    const map = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Win' }
    return combo.split('+').map((p) => map[p] || (p.length === 1 ? p.toUpperCase() : p)).join('+')
  },
  matchesHotkey(e, hotkey) {
    const combo = this.comboFromEvent(e)
    return combo !== null && combo === hotkey
  },
}

return {
  inject: ['slots'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const t = (key, vars) => __u.t(state.lang, key, vars)

    // ────────────────────────────────────────────────────────────────────
    // Store
    // ────────────────────────────────────────────────────────────────────

    let listeners = []
    let state = {
      pending: null,
      picking: false,
      hotkey: 'ctrl+shift+u',
      recording: false,
      lang: 'zh',
      insertAbsolutePaths: false,
      showFullPathsDefault: false,
    }
    const setState = (patch) => {
      state = Object.assign({}, state, patch)
      for (const fn of listeners.slice()) fn(state)
    }
    const getState = () => state
    const subscribe = (fn) => {
      listeners.push(fn)
      return () => { listeners = listeners.filter((x) => x !== fn) }
    }

    // ────────────────────────────────────────────────────────────────────
    // Flows
    // ────────────────────────────────────────────────────────────────────

    const openError = (sessionId, message) => {
      setState({
        picking: false,
        pending: { paths: [], workspaceRoot: '', destRoot: '', engine: 'pwsh7', sessionId: sessionId || null, mode: 'workspace', status: 'error', results: null, summary: null, errorText: message },
      })
    }

    const pick = async (sessionId) => {
      if (state.picking || state.pending) return
      setState({ picking: true })
      try {
        const res = await host.call('pick-files', {})
        if (!res || res.cancelled) { setState({ picking: false }); return }
        if (res.error) { openError(sessionId, res.error); return }
        if (!Array.isArray(res.paths) || res.paths.length === 0) { setState({ picking: false }); return }
        setState({
          picking: false,
          pending: {
            paths: res.paths,
            workspaceRoot: typeof res.workspaceRoot === 'string' ? res.workspaceRoot : '',
            destRoot: typeof res.destRoot === 'string' ? res.destRoot : '',
            engine: res.engine === 'ps51' ? 'ps51' : 'pwsh7',
            sessionId: sessionId || null,
            mode: 'workspace',
            status: 'choose',
            results: null,
            summary: null,
            errorText: null,
          },
        })
      } catch (err) {
        openError(sessionId, err && err.message ? err.message : String(err))
      }
    }

    const confirmUpload = async (p, mode, insertPaths) => {
      setState({ pending: Object.assign({}, p, { mode, status: 'working' }) })
      try {
        if (mode === 'input') {
          insertPaths(p.paths)
          setState({ pending: Object.assign({}, p, { mode, status: 'done', summary: t('insertedSummary', { n: p.paths.length }) }) })
          return
        }
        const res = await host.call('upload-files', { paths: p.paths })
        if (res && res.error) throw new Error(res.error)
        const results = res && Array.isArray(res.results) ? res.results : []
        if (mode === 'both') insertPaths(p.paths)
        const okCount = results.filter((r) => r && r.ok === true).length
        const failCount = results.length - okCount
        let summary = t('copiedSummary', { ok: okCount, total: results.length })
        if (failCount > 0) summary += t('copiedSummaryFail', { n: failCount })
        if (mode === 'both') summary += t('alsoInserted')
        setState({ pending: Object.assign({}, p, { mode, status: 'done', results, summary }) })
      } catch (err) {
        setState({ pending: Object.assign({}, p, { mode, status: 'error', errorText: err && err.message ? err.message : String(err) }) })
      }
    }

    const closeModal = () => setState({ pending: null })

    // ────────────────────────────────────────────────────────────────────
    // Components
    // ────────────────────────────────────────────────────────────────────

    const MODE_OPTIONS = () => [
      { id: 'workspace', icon: '📁', label: t('modeWorkspace'), desc: t('modeWorkspaceDesc') },
      { id: 'input', icon: '✏️', label: t('modeInput'), desc: t('modeInputDesc') },
      { id: 'both', icon: '🔀', label: t('modeBoth'), desc: t('modeBothDesc') },
    ]

    function Trigger(props) {
      const [snap, setSnap] = React.useState(getState())
      React.useEffect(() => subscribe(setSnap), [])
      return React.createElement('button', {
        className: 'dsh-upload-trigger',
        title: t('triggerTitle', { hotkey: __u.comboLabel(snap.hotkey) }),
        disabled: snap.picking,
        onClick: () => pick(props.sessionId),
      }, snap.picking ? t('triggerSelecting') : t('triggerUpload'))
    }

    function Chooser(props) {
      const [snap, setSnap] = React.useState(getState())
      const [showFull, setShowFull] = React.useState(getState().showFullPathsDefault)
      React.useEffect(() => subscribe(setSnap), [])
      const inputState = typeof props.useInput === 'function' ? props.useInput((s) => s) : undefined
      const pending = snap.pending
      if (!pending) return null
      if (pending.sessionId && pending.sessionId !== props.sessionId) return null

      const insertPaths = (paths) => {
        if (!props.inputActions) return
        const draft = inputState && typeof inputState.draft === 'string' ? inputState.draft : ''
        const text = __u.buildInsertText(paths, pending.workspaceRoot, snap.insertAbsolutePaths, state.lang)
        props.inputActions.setDraft(draft.length > 0 ? draft + '\n' + text : text)
      }
      const setMode = (m) => setState({ pending: Object.assign({}, pending, { mode: m }) })
      const onConfirm = () => void confirmUpload(pending, pending.mode, insertPaths)

      const hasOutside = pending.paths.some((p) => !__u.isUnderWorkspace(p, pending.workspaceRoot))
      const absActive = snap.insertAbsolutePaths && (pending.mode === 'input' || pending.mode === 'both')

      const rows = []
      if (pending.status === 'choose') {
        rows.push(React.createElement('div', { key: 't', className: 'dsh-upload-title' }, t('modalTitle', { n: pending.paths.length })))
        rows.push(React.createElement('div', { key: 'f', className: 'dsh-upload-files' },
          pending.paths.map((p, i) => React.createElement('div', { key: i }, showFull ? String(p) : __u.basename(p)))))
        rows.push(React.createElement('div', { key: 'r', className: 'dsh-upload-reveal' },
          React.createElement('button', { type: 'button', className: 'dsh-upload-link', onClick: () => setShowFull(!showFull) },
            showFull ? t('hideFullPaths') : t('showFullPaths'))))
        rows.push(React.createElement('div', { key: 'm', className: 'dsh-upload-mode' },
          MODE_OPTIONS().map((opt) => React.createElement('button', {
            key: opt.id,
            type: 'button',
            className: 'dsh-upload-mode-opt' + (pending.mode === opt.id ? ' selected' : ''),
            onClick: () => setMode(opt.id),
          },
            React.createElement('b', null, opt.icon + ' ' + opt.label),
            React.createElement('span', null, opt.desc),
          ))))
        if (pending.engine === 'ps51') {
          rows.push(React.createElement('div', { key: 'en', className: 'dsh-upload-engine' }, t('engine51')))
        }
        if (absActive) {
          rows.push(React.createElement('div', { key: 'aw', className: 'dsh-upload-warn' }, t('absPathWarn')))
        }
        if (pending.mode === 'input' && hasOutside) {
          rows.push(React.createElement('div', { key: 'ow', className: 'dsh-upload-warn' }, t('outsideWarn')))
        }
        if (pending.mode !== 'input' && pending.destRoot) {
          rows.push(React.createElement('div', { key: 'd', className: 'dsh-upload-dest' }, t('destRoot', { path: pending.destRoot })))
        }
        const noticeLines = []
        if (pending.mode === 'workspace' || pending.mode === 'both') {
          noticeLines.push(t('noticeCopy', { n: pending.paths.length, path: pending.destRoot }))
        }
        if (pending.mode === 'input' || pending.mode === 'both') {
          noticeLines.push(t('noticeInsert', { mode: absActive ? t('noticeInsertOn') : t('noticeInsertOff') }))
        }
        rows.push(React.createElement('div', { key: 'n', className: 'dsh-upload-notice' },
          noticeLines.map((line, i) => React.createElement('div', { key: i }, line))))
        rows.push(React.createElement('div', { key: 'a', className: 'dsh-upload-actions' },
          React.createElement('button', { type: 'button', className: 'dsh-upload-btn', onClick: closeModal }, t('cancel')),
          React.createElement('button', { type: 'button', className: 'dsh-upload-btn primary', onClick: onConfirm }, t('confirm')),
        ))
      } else if (pending.status === 'working') {
        rows.push(React.createElement('div', { key: 'w', className: 'dsh-upload-status' }, t('working')))
      } else if (pending.status === 'done') {
        rows.push(React.createElement('div', { key: 's', className: 'dsh-upload-status' }, pending.summary))
        if (pending.results && pending.results.length > 0) {
          const resultRows = pending.results.slice(0, 30).map((r, i) => {
            const ok = r && r.ok === true
            const name = r && r.basename ? r.basename : ''
            const target = r && r.ok && r.dest ? ' → ' + (__u.workspaceRelative(r.dest, pending.workspaceRoot) || r.dest) : ''
            const err = r && !r.ok && r.error ? ' — ' + (r.error === 'source-missing' ? t('sourceMissing') : r.error) : ''
            return React.createElement('div', { key: i, className: ok ? 'ok' : 'fail' },
              (ok ? '✓ ' : '✗ ') + name + target + err)
          })
          rows.push(React.createElement('div', { key: 'r2', className: 'dsh-upload-result' }, resultRows))
        }
        rows.push(React.createElement('div', { key: 'a2', className: 'dsh-upload-actions' },
          React.createElement('button', { type: 'button', className: 'dsh-upload-btn primary', onClick: closeModal }, t('done'))))
      } else {
        rows.push(React.createElement('div', { key: 'e', className: 'dsh-upload-status fail-text' }, t('error', { msg: pending.errorText })))
        rows.push(React.createElement('div', { key: 'a3', className: 'dsh-upload-actions' },
          React.createElement('button', { type: 'button', className: 'dsh-upload-btn', onClick: closeModal }, t('close'))))
      }

      return React.createElement('div', { className: 'dsh-upload-modal' },
        React.createElement('div', { className: 'dsh-upload-card' }, rows))
    }

    function HotkeyRow() {
      const [snap, setSnap] = React.useState(getState())
      React.useEffect(() => subscribe(setSnap), [])
      const recording = snap.recording
      React.useEffect(() => {
        if (!recording) return
        const onKeydown = (e) => {
          e.preventDefault()
          e.stopPropagation()
          if (e.key === 'Escape') { setState({ recording: false }); return }
          const combo = __u.comboFromEvent(e)
          if (combo === null) return
          const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey
          const isFunctionKey = typeof e.key === 'string' && /^f\d{1,2}$/i.test(e.key)
          if (!hasModifier && !isFunctionKey) return
          setState({ recording: false, hotkey: combo })
        }
        document.addEventListener('keydown', onKeydown, true)
        return () => document.removeEventListener('keydown', onKeydown, true)
      }, [recording])

      return React.createElement('div', { className: 'dsh-upload-hotkey-row' },
        React.createElement('div', null,
          React.createElement('div', { className: 'dsh-upload-hotkey-label' }, t('hotkeyLabel')),
          React.createElement('div', { className: 'dsh-upload-hotkey-hint' }, recording ? t('hotkeyHintRecording') : t('hotkeyHint')),
        ),
        React.createElement('button', {
          type: 'button',
          className: 'dsh-upload-hotkey-chip' + (recording ? ' recording' : ''),
          onClick: () => setState({ recording: true }),
        }, recording ? t('hotkeyRecording') : __u.comboLabel(snap.hotkey)),
      )
    }

    function LanguageRow() {
      const [snap, setSnap] = React.useState(getState())
      React.useEffect(() => subscribe(setSnap), [])
      return React.createElement('div', { className: 'dsh-upload-hotkey-row' },
        React.createElement('div', null,
          React.createElement('div', { className: 'dsh-upload-hotkey-label' }, t('langLabel')),
        ),
        React.createElement('div', { className: 'dsh-upload-seg' },
          React.createElement('button', {
            type: 'button',
            className: 'dsh-upload-seg-btn' + (snap.lang === 'zh' ? ' selected' : ''),
            onClick: () => setState({ lang: 'zh' }),
          }, t('langZh')),
          React.createElement('button', {
            type: 'button',
            className: 'dsh-upload-seg-btn' + (snap.lang === 'en' ? ' selected' : ''),
            onClick: () => setState({ lang: 'en' }),
          }, t('langEn')),
        ),
      )
    }

    function PrivacyRow() {
      const [snap, setSnap] = React.useState(getState())
      React.useEffect(() => subscribe(setSnap), [])
      return React.createElement('div', { className: 'dsh-upload-hotkey-row' },
        React.createElement('div', null,
          React.createElement('div', { className: 'dsh-upload-hotkey-label' }, t('privacyLabel')),
          React.createElement('div', { className: 'dsh-upload-hotkey-hint' }, t('privacyHint')),
        ),
        React.createElement('button', {
          type: 'button',
          className: 'dsh-upload-seg-btn' + (snap.insertAbsolutePaths ? ' selected' : ''),
          onClick: () => setState({ insertAbsolutePaths: !snap.insertAbsolutePaths }),
        }, snap.insertAbsolutePaths ? t('privacyOn') : t('privacyOff')),
      )
    }

    function ShowFullPathsRow() {
      const [snap, setSnap] = React.useState(getState())
      React.useEffect(() => subscribe(setSnap), [])
      return React.createElement('div', { className: 'dsh-upload-hotkey-row' },
        React.createElement('div', null,
          React.createElement('div', { className: 'dsh-upload-hotkey-label' }, t('showFullSetting')),
          React.createElement('div', { className: 'dsh-upload-hotkey-hint' }, t('showFullHint')),
        ),
        React.createElement('button', {
          type: 'button',
          className: 'dsh-upload-seg-btn' + (snap.showFullPathsDefault ? ' selected' : ''),
          onClick: () => setState({ showFullPathsDefault: !snap.showFullPathsDefault }),
        }, snap.showFullPathsDefault ? t('privacyOn') : t('privacyOff')),
      )
    }

    function SettingsPage() {
      const [snap, setSnap] = React.useState(getState())
      React.useEffect(() => subscribe(setSnap), [])
      return React.createElement('div', { className: 'dsh-upload-settings' },
        React.createElement(HotkeyRow),
        React.createElement(LanguageRow),
        React.createElement('div', { className: 'dsh-upload-section-title' }, t('privacySection')),
        React.createElement('div', { className: 'dsh-upload-section-hint' }, t('privacyExplain')),
        React.createElement(PrivacyRow),
        React.createElement(ShowFullPathsRow),
      )
    }

    // ────────────────────────────────────────────────────────────────────
    // Apply wiring: hotkey, styles, slots
    // ────────────────────────────────────────────────────────────────────

    ctx.effect(() => {
      const onKeydown = (e) => {
        if (state.recording) return
        if (__u.matchesHotkey(e, state.hotkey)) {
          e.preventDefault()
          e.stopPropagation()
          void pick(null)
        }
      }
      document.addEventListener('keydown', onKeydown, true)
      return () => document.removeEventListener('keydown', onKeydown, true)
    }, 'dsh-file-upload hotkey')

    try {
      const localeService = ctx.get('locale')
      if (localeService && typeof localeService.getLocale === 'function') {
        const snap = localeService.getLocale()
        const id = snap && typeof snap.id === 'string' ? snap.id : ''
        if (id.toLowerCase().startsWith('zh')) state.lang = 'zh'
        else if (id.toLowerCase().startsWith('en')) state.lang = 'en'
      }
    } catch (e) { /* keep default */ }

    styles.insert(`
.dsh-upload-modal { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); }
.dsh-upload-card { width: min(560px, 94vw); max-height: 82vh; overflow: auto; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; padding: 18px 20px; color: var(--dsw-alias-label-primary); font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 12px 40px rgba(0,0,0,.3); }
.dsh-upload-title { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
.dsh-upload-files { max-height: 180px; overflow: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 10px; margin-bottom: 4px; font-size: 12px; }
.dsh-upload-files div { padding: 2px 0; word-break: break-all; }
.dsh-upload-reveal { margin-bottom: 10px; }
.dsh-upload-link { background: none; border: none; color: var(--dsw-alias-brand-primary); font-size: 12px; cursor: pointer; padding: 0; }
.dsh-upload-mode { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.dsh-upload-mode-opt { flex: 1 1 150px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 10px; cursor: pointer; background: transparent; color: inherit; text-align: left; }
.dsh-upload-mode-opt.selected { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }
.dsh-upload-mode-opt b { display: block; font-size: 13px; }
.dsh-upload-mode-opt span { display: block; font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 2px; }
.dsh-upload-dest { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-bottom: 12px; word-break: break-all; }
.dsh-upload-engine { font-size: 12px; color: var(--dsw-alias-state-warn-primary); margin-bottom: 12px; }
.dsh-upload-warn { font-size: 12px; color: var(--dsw-alias-state-warn-primary); margin-bottom: 12px; }
.dsh-upload-notice { font-size: 12px; color: var(--dsw-alias-label-secondary); border: 1px dashed var(--dsw-alias-border-l2); border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; }
.dsh-upload-notice div { padding: 2px 0; }
.dsh-upload-section-title { font-size: 13px; font-weight: 600; margin: 18px 0 4px; }
.dsh-upload-section-hint { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-bottom: 12px; }
.dsh-upload-settings .dsh-upload-hotkey-row { margin-bottom: 16px; }
.dsh-upload-actions { display: flex; justify-content: flex-end; gap: 8px; }
.dsh-upload-btn { border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); padding: 6px 14px; font-size: 13px; cursor: pointer; }
.dsh-upload-btn.primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: #fff; }
.dsh-upload-status { font-size: 13px; margin-bottom: 10px; }
.dsh-upload-status.fail-text { color: var(--dsw-alias-state-error-primary); }
.dsh-upload-result { font-size: 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 10px; max-height: 200px; overflow: auto; margin-bottom: 12px; }
.dsh-upload-result .ok { color: var(--dsw-alias-state-success-primary); }
.dsh-upload-result .fail { color: var(--dsw-alias-state-error-primary); }
.dsh-upload-hotkey-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dsh-upload-hotkey-label { font-size: 13px; }
.dsh-upload-hotkey-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 2px; }
.dsh-upload-hotkey-chip { border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); padding: 4px 10px; font-size: 12px; font-family: ui-monospace, monospace; cursor: pointer; min-width: 130px; text-align: center; }
.dsh-upload-hotkey-chip.recording { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dsh-upload-trigger { background: transparent; border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); border-radius: 6px; font-size: 12px; padding: 2px 8px; cursor: pointer; }
.dsh-upload-trigger:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.dsh-upload-seg { display: flex; gap: 6px; }
.dsh-upload-seg-btn { border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 4px 12px; cursor: pointer; }
.dsh-upload-seg-btn.selected { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
`)

    slots.inject('conversation.input.overlay', () => slots.register(
      { name: 'conversation.input.overlay', id: 'dsh-file-upload-chooser' },
      (props) => React.createElement(Chooser, props),
    ))
    slots.inject('conversation.input.left', () => slots.register(
      { name: 'conversation.input.left', id: 'dsh-file-upload-trigger' },
      (props) => React.createElement(Trigger, props),
    ))
    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'dsh-file-upload', order: 100, label: () => t('sectionLabel') },
      () => React.createElement(SettingsPage),
    ))
  },
}
