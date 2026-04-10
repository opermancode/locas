'use strict';
  const { contextBridge, ipcRenderer } = require('electron');

  // ── Update state cache ────────────────────────────────────────────
  let _updateState = null;

  contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    // ── PDF ──────────────────────────────────────────────────────────
    savePDF: (html, filename) => ipcRenderer.invoke('save-pdf', { html, filename }),

    // ── File-based DB ────────────────────────────────────────────────
    // Each call maps to a JSON file in .locas-data/ next to Locas.exe
    db: {
      read:    (store)           => ipcRenderer.invoke('db-read',    store),
      write:   (store, data)     => ipcRenderer.invoke('db-write',   store, data),
      clear:   (store)           => ipcRenderer.invoke('db-clear',   store),
      get:     (store, key)      => ipcRenderer.invoke('db-get',     store, key),
      set:     (store, key, val) => ipcRenderer.invoke('db-set',     store, key, val),
      remove:  (store, key)      => ipcRenderer.invoke('db-remove',  store, key),
      keys:    (store)           => ipcRenderer.invoke('db-keys',    store),
      hasData: ()                => ipcRenderer.invoke('db-has-data'),
      dataPath:()                => ipcRenderer.invoke('db-data-path'),
      openFolder:()              => ipcRenderer.invoke('db-open-folder'),
      export:  (opts)            => ipcRenderer.invoke('db-export',  opts),
      import:  (opts)            => ipcRenderer.invoke('db-import',  opts),
    },

    // ── Updates ──────────────────────────────────────────────────────
    checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
    installUpdate:  () => ipcRenderer.invoke('install-update'),
    getUpdateState: () => _updateState,

    onUpdateDownloading: (cb) => {
      const h = (_, d) => { _updateState = { status:'downloading', version:d.version, notes:d.notes||'', progress:0 }; cb(d); };
      ipcRenderer.on('update-downloading', h);
      return () => ipcRenderer.removeListener('update-downloading', h);
    },
    onUpdateProgress: (cb) => {
      const h = (_, p) => { if (_updateState) _updateState.progress = p; cb(p); };
      ipcRenderer.on('update-progress', h);
      return () => ipcRenderer.removeListener('update-progress', h);
    },
    onUpdateReady: (cb) => {
      const h = (_, d) => { _updateState = { status:'ready', version:d.version, notes:d.notes||'', path:d.path }; cb(d); };
      ipcRenderer.on('update-ready', h);
      return () => ipcRenderer.removeListener('update-ready', h);
    },
    onUpdateAlreadyLatest: (cb) => {
      const h = (_, d) => { _updateState = null; cb(d); };
      ipcRenderer.on('update-already-latest', h);
      return () => ipcRenderer.removeListener('update-already-latest', h);
    },
    onUpdateError: (cb) => {
      const h = (_, d) => { cb(d); };
      ipcRenderer.on('update-error', h);
      return () => ipcRenderer.removeListener('update-error', h);
    },
    onUpdateInstallerMissing: (cb) => {
      const h = (_, d) => { _updateState = null; cb(d); };
      ipcRenderer.on('update-installer-missing', h);
      return () => ipcRenderer.removeListener('update-installer-missing', h);
    },
  });