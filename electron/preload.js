'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ─── Persistent Device ID ────────────────────────────────────────────────────
// Stored in a file next to the app data so it survives app reinstalls.
// On Windows: C:\Users\<name>\AppData\Roaming\Locas\device.id
// On Mac/Linux: ~/Library/Application Support/Locas/device.id

function getOrCreateDeviceId() {
  try {
    // Use the same userData path Electron uses for app data
    const userDataPath = ipcRenderer.sendSync('get-user-data-path');
    const idFile = path.join(userDataPath, 'device.id');

    if (fs.existsSync(idFile)) {
      const id = fs.readFileSync(idFile, 'utf8').trim();
      if (id && id.length > 8) return id;
    }

    // Generate a new stable ID
    const newId = generateUUID();
    fs.mkdirSync(path.dirname(idFile), { recursive: true });
    fs.writeFileSync(idFile, newId, 'utf8');
    return newId;
  } catch (e) {
    // Fallback: use machine hostname + platform as a semi-stable fingerprint
    return `electron-${os.hostname()}-${os.platform()}`.replace(/[^a-zA-Z0-9-]/g, '_');
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Stable device ID that survives reinstalls
  getDeviceId: () => getOrCreateDeviceId(),

  // PDF export
  savePDF: (html, filename) => ipcRenderer.invoke('save-pdf', { html, filename }),

  // Trigger manual update check (called from Settings)
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),

  // Open the downloaded installer wizard
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // main → renderer: download starting
  onUpdateDownloading:     (cb) => ipcRenderer.on('update-downloading',      (_, d) => cb(d)),
  // main → renderer: progress 0-100
  onUpdateProgress:        (cb) => ipcRenderer.on('update-progress',         (_, p) => cb(p)),
  // main → renderer: download finished, ready to install
  onUpdateReady:           (cb) => ipcRenderer.on('update-ready',            (_, d) => cb(d)),
  // main → renderer: already on latest version
  onUpdateAlreadyLatest:   (cb) => ipcRenderer.on('update-already-latest',   (_, d) => cb(d)),
  // main → renderer: download/check failed
  onUpdateError:           (cb) => ipcRenderer.on('update-error',            (_, d) => cb(d)),
  // main → renderer: cached installer file is missing, need re-download
  onUpdateInstallerMissing:(cb) => ipcRenderer.on('update-installer-missing',(_, d) => cb(d)),
});
