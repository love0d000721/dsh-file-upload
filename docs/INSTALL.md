# Installing dsh-file-upload

Two loading paths. The **dynamic session load** is the fastest way to try the plugin and is
what the shipped `body.js` files are shaped for. The **host-composition mount** makes it a
persistent capability of your harness.

Both paths run the same code — the RPC seam is the only difference (dynamic: `harness.handle`
/ `host.call`; a future static package build would swap to a typert `@Remote` namespace).

---

## Path A — Dynamic session load (fast, no restart)

The dynamic Cordis tools load plain-JS plugin bodies into the current process.

1. Open a DSH session with the `cordis` tools available.
2. Ask your agent to define a new plugin with:
   - `code.host` ← the full content of `src/host/body.js`
   - `code.client` ← the full content of `src/client/body.js`
3. `cordis_run` the returned `pluginId`/`packageId` and approve the client half.
4. The trigger button appears in the composer's left tool row; press `Ctrl+Shift+U`
   (or the recorded hotkey) to pick files.

Notes:

- Dynamic plugins are process-local: they vanish on harness restart. Use Path B for a
  persistent install.
- The PowerShell scripts run from embedded copies; keep `assets/*.ps1` in sync with
  `npm run sync:assets`.

## Path B — Host-composition mount (persistent)

> Status: the **host half** is fully mountable as a local composition row (the loader
> supports relative module paths). A full persistent install also needs the **client half**
> wired into the web boot graph (`dsh.client` package scan + bundle), which is a packaging
> step documented in the repo issue tracker. Until then, the recommended workflow is
> Path A per session, or follow the issue for the static package.

### Host row

The loader accepts relative module names, so a composition overlay can reference this
directory directly (see [cordis.row.yml](../cordis.row.yml)). Example overlay:

```yaml
- insert:
    - id: dsh-file-upload
      name: './dsh-file-upload/plugin.host.mjs'
```

Apply it with `dsh --patch ./path/to/overlay.cordis.yml` (host-side) — a restart is required.

## Requirements

- Windows 10/11
- PowerShell 7 (recommended) or the built-in Windows PowerShell 5.1
- DeepSeek Harness (web profile) for the client UI slots
