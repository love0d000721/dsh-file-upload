# dsh-file-upload

Windows file upload for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): a
configurable hotkey opens the native Windows file dialog (via **PowerShell 7**, with a labeled
Windows PowerShell 5.1 fallback), then a graphical chooser lets you **copy files into the
workspace**, **insert a safe file list into the composer**, or **both**. The UI is bilingual
(中文 / English, switchable in Settings). Privacy is protected by default — see [Privacy](#privacy).

> ⚠️ Windows-only. Requires PowerShell 7 (recommended) or the built-in Windows PowerShell 5.1.

[中文说明](./README.zh-CN.md)

## Features

- **Hotkey**: `Ctrl+Shift+U` by default — record any combination from Settings
  (click the key, then press the new one; Esc cancels).
- **Reliable & simple**: every pick spawns ONE short-lived PowerShell process
  (no persistent server — that design hung in some environments and was
  removed). Engine paths are resolved without probe processes, and every wait
  has a hard timeout, so the pick can never hang.
- **Engine discovery**: PowerShell 7 first (MSI → PATH → `where pwsh` → Store alias →
  Chocolatey), each candidate probed with a real spawn; Windows PowerShell 5.1 as a
  clearly-labeled last resort. The result is cached.
- **Three upload modes** (graphical, no code switching):
  - 📁 **Copy to workspace** — files land in `<workspace>\uploads\` (name collisions
    become `name (1).ext`); the agent can read them.
  - ✏️ **Insert into input** — a safe file list is added to the composer.
  - 🔀 **Both** — copy *and* insert workspace-relative paths.
- **Bilingual UI**: 中文 / English, switchable in Settings → File Upload.
- **Privacy controls** — see below.

## Privacy

The plugin never reads file *contents* and never scans your disk. What it handles:

| Data | Where it goes |
|---|---|
| Selected file paths | Your browser only (modal + the copy request over loopback RPC) |
| Copied files | Your workspace `<workspace>\uploads\` only |
| Text inserted into the composer | Your next message — **controlled by settings below** |

**Default-safe behaviors (all user-configurable in Settings → File Upload → Privacy):**

- The modal lists **file names only**; full paths require an explicit "Show full paths" reveal.
- Text inserted into the composer never contains absolute paths unless you opt in:
  it uses **workspace-relative paths** (e.g. `uploads/foo.txt`) when the file was copied
  into the workspace, and **bare names** otherwise.
- The setting **Insert absolute paths** (default **OFF**) switches insertion to full paths;
  when ON, the upload modal shows a warning that absolute paths will be sent with your
  message to the model.
- At upload time the modal always shows a **notice** explaining where files go and whether
  absolute paths are included.

Nothing is sent to any network or model except what you deliberately place in the composer.

## Install

See [docs/INSTALL.md](./docs/INSTALL.md) for both loading paths (dynamic session load and
host-composition mount) and [cordis.row.yml](./cordis.row.yml) for the composition row.

Quick start (dynamic load in a session):

1. Read `src/host/body.js` → paste as `code.host` of a new Cordis plugin.
2. Read `src/client/body.js` → paste as `code.client`.
3. `cordis_run` and approve the client half.

## Development

```sh
npm test            # unit + drift tests (zero-dependency runner)
npm run sync:assets # after editing assets/*.ps1, re-embed them into src/host/body.js
```

Layout:

```
src/host/body.js      # Host half: spawn-free engine discovery, one-shot spawns, hard timeouts
src/client/body.js    # Client half: i18n, privacy-safe flows, chooser/settings UI
assets/*.ps1          # Canonical PowerShell scripts (pick / copy)
tests/                # node tests/run-tests.mjs — fake-driven + real-pwsh integration
scripts/sync-assets.mjs
```

The two `body.js` files are **plain-JS dynamic-plugin bodies** (no imports), which makes them
loadable through the cordis dynamic tools and testable in Node. The PowerShell scripts live in
`assets/` as the reviewable source of truth; `tests/drift.test.mjs` fails if the embedded
copies drift.

## Troubleshooting

- **"No usable PowerShell found"** — install PowerShell 7:
  <https://github.com/PowerShell/PowerShell/releases>. The plugin also accepts the
  built-in 5.1 (labeled in the modal).
- **"open dialog failed"** — the first pick pays engine discovery (~1s); later
  picks reuse the cached path and are faster. The error text names the failing
  step; the engine discovery is spawn-free and every step has a timeout.
- **Store-installed PowerShell** — the discovery chain resolves the Microsoft Store alias
  (`%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe`) automatically.

## License

MIT — see [LICENSE](./LICENSE).
