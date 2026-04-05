'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Save invoice as PDF using Electron's printToPDF
  savePDF: (html, filename) => ipcRenderer.invoke('save-pdf', { html, filename }),
  // Check if running inside Electron
  isElectron: true,
});