  'use strict';
  const { contextBridge, ipcRenderer } = require('electron');

  contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    // PDF
    savePDF: (html, filename) => ipcRenderer.invoke('save-pdf', { html, filename }),

    // Update — main → renderer events
    onUpdateDownloading: (cb) => ipcRenderer.on('update-downloading', (_, d) => cb(d)),
    onUpdateProgress:    (cb) => ipcRenderer.on('update-progress',    (_, p) => cb(p)),
    onUpdateReady:       (cb) => ipcRenderer.on('update-ready',       (_, d) => cb(d)),

    // Update — renderer → main (user clicked Install)
    installUpdate: () => ipcRenderer.invoke('install-update'),
  });