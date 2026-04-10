  'use strict';
  const { contextBridge, ipcRenderer } = require('electron');

  contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    // PDF export
    savePDF: (html, filename) => ipcRenderer.invoke('save-pdf', { html, filename }),

    // Trigger manual update check (called from Settings)
    checkForUpdate: () => ipcRenderer.invoke('check-for-update'),

    // Open the downloaded installer wizard
    installUpdate: () => ipcRenderer.invoke('install-update'),

    // main → renderer: download starting
    onUpdateDownloading:      (cb) => ipcRenderer.on('update-downloading',       (_, d) => cb(d)),
    // main → renderer: progress 0-100
    onUpdateProgress:         (cb) => ipcRenderer.on('update-progress',          (_, p) => cb(p)),
    // main → renderer: download finished, ready to install
    onUpdateReady:            (cb) => ipcRenderer.on('update-ready',             (_, d) => cb(d)),
    // main → renderer: already on latest version
    onUpdateAlreadyLatest:    (cb) => ipcRenderer.on('update-already-latest',    (_, d) => cb(d)),
    // main → renderer: download/check failed
    onUpdateError:            (cb) => ipcRenderer.on('update-error',             (_, d) => cb(d)),
    // main → renderer: cached installer file is missing, need re-download
    onUpdateInstallerMissing: (cb) => ipcRenderer.on('update-installer-missing', (_, d) => cb(d)),
  });