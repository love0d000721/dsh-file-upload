# Changelog

All notable changes to dsh-file-upload.

## [0.2.2] - 2025-01

### Fixed
- **Hotkey hung at "Selecting…" while the button worked** — the global keydown
  listener called `pick()` directly, so `host.call` ran without a session
  context and the RPC could wedge. The hotkey now sets a `pendingHotkeyPick`
  flag; the session-scoped composer Trigger performs the actual pick, making
  the hotkey path identical to the button path.
- **Long waits on a wedged dialog spawn** — the pre-dialog READY cap was
  lowered from 15s to **5s** per candidate, so a wedged Store-alias spawn
  falls through to the next engine (e.g. Windows PowerShell 5.1) in seconds.

### Changed
- `waitForReady` cap: 15s → 5s (`src/host/body.js`).

## [0.2.1] - 2025-01

### Fixed
- **Hang on "Selecting…"** — the persistent `pwsh` server (added in 0.2.0)
  could wedge the pick in some environments. Removed entirely; the plugin now
  spawns ONE short-lived PowerShell process per pick (the proven one-shot
  path). Engine discovery is spawn-free (no probe processes), and every wait
  has a hard timeout, so the pick can never hang.

### Removed
- Persistent `pwsh` server, warm-up effect, READY handshake, and probe spawns
  (`assets/server.ps1` deleted; `src/host/body.js` simplified).

## [0.2.0] - 2025-01

### Added
- Bilingual UI (中文 / English) with a Settings toggle (Settings → File Upload → UI language).
- Privacy controls with explanations (Settings → File Upload → Privacy):
  - `Insert absolute paths` (default OFF) — when OFF, composer insertion uses
    workspace-relative paths or bare file names, never absolute local paths.
  - `Show full paths in file list` (default OFF) — the picker lists names by default;
    full paths need an explicit reveal.
  - Upload-time notice in the modal explaining where files go and the absolute-path mode.
- GitHub-ready project structure: `src/host` + `src/client` single-file bodies, canonical
  `assets/*.ps1`, zero-dependency test suite (`tests/run-tests.mjs`), drift guard,
  `scripts/sync-assets.mjs`, bilingual README, LICENSE, CHANGELOG.

### Changed
- Host handlers return `basename`-enriched copy results; the UI renders names and
  workspace-relative targets instead of source absolute paths.
- Settings moved from General rows into a dedicated "File Upload" settings section.

## [0.1.0] - 2025-01

### Added
- Hotkey (`Ctrl+Shift+U`) opens the native Windows file dialog via PowerShell 7
  (Windows PowerShell 5.1 labeled fallback; discovery chain: MSI → PATH → `where pwsh` →
  Store alias → Chocolatey, each candidate probed and cached).
- Graphical three-mode chooser: copy to workspace `uploads/` (collision-safe),
  insert into composer, or both.
- Hotkey recorder in Settings (click → clear → press new combination; Esc cancels).
- UTF-8-safe path handling for Chinese / spaced filenames on both engines.
