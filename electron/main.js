// @ts-nocheck
/* eslint-disable */
'use strict';

const { app, BrowserWindow, shell, ipcMain, dialog, Notification } = require('electron');
const path  = require('path');
const fs    = require('fs');
const https = require('https');

const UPDATE_URL  = 'https://locas-business.vercel.app/updates/latest.json';
const CURRENT_VER = app.getVersion();

let mainWindow       = null;
let updateCheckTimer = null;
let pendingInstaller = null;

// ── Version compare ───────────────────────────────────────────────
function isNewer(remote, current) {
  const r = (remote  || '0.0.0').split('.').map(Number);
  const c = (current || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((r[i]||0) > (c[i]||0)) return true;
    if ((r[i]||0) < (c[i]||0)) return false;
  }
  return false;
}

// ── Fetch update manifest ─────────────────────────────────────────
function fetchManifest() {
  return new Promise((resolve, reject) => {
    const req = https.get(UPDATE_URL, { timeout: 10000 }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Bad JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Download installer ────────────────────────────────────────────
function downloadInstaller(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      const total = parseInt(res.headers['content-length'] || '0');
      let done = 0;
      res.on('data', chunk => {
        file.write(chunk);
        done += chunk.length;
        if (total > 0 && onProgress) onProgress(Math.round((done / total) * 100));
      });
      res.on('end', () => { file.end(); resolve(); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Send event to renderer ────────────────────────────────────────
function toRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ── Show Windows system notification ─────────────────────────────
function showWinNotification(version, notes) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: `Locas ${version} is ready ✓`,
    body:  notes ? notes.slice(0, 100) : 'Click to install and restart.',
    icon:  path.join(__dirname, '../assets/icon.png'),
    silent: false,
  });
  n.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (pendingInstaller) doInstall(pendingInstaller);
  });
  n.show();
}

// ── Silent NSIS install + quit ────────────────────────────────────
// FIX: spawn UNKNOWN on Windows is caused by spaces in path + spawn directly
// Solution: write a tiny .bat that calls the installer with /S, run via cmd.exe
function doInstall(installerPath) {
  console.log('[update] launching installer:', installerPath);

  if (!fs.existsSync(installerPath)) {
    console.log('[update] installer file missing');
    pendingInstaller = null;
    dialog.showErrorBox('Update Error', 'Installer file not found. Please restart the app to re-download.');
    return;
  }

  try {
    // Write a tiny batch file — avoids spawn UNKNOWN with spaces in path
    const batPath = path.join(app.getPath('temp'), 'locas-update.bat');
    // Double-quote the path in the batch file to handle spaces
    fs.writeFileSync(batPath, `@echo off\nstart "" /wait "${installerPath}" /S\n`);

    const { spawn } = require('child_process');
    const child = spawn('cmd.exe', ['/c', batPath], {
      detached: true,
      stdio:    'ignore',
      windowsHide: true,
      shell: false,
    });
    child.unref();

    // Give cmd.exe time to start before quitting
    setTimeout(() => app.quit(), 500);

  } catch (e) {
    console.log('[update] bat launch failed:', e.message);
    // Final fallback: shell.openPath just opens the installer (user sees wizard, no /S)
    shell.openPath(installerPath).then(() => {
      setTimeout(() => app.quit(), 1500);
    });
  }
}

// ── Main check + download flow ────────────────────────────────────
async function checkForUpdate() {
  try {
    const manifest = await fetchManifest();
    if (!isNewer(manifest.version, CURRENT_VER)) return;

    const tempDir  = app.getPath('temp');
    const exeName  = `Locas.Setup.${manifest.version}.exe`;
    const destPath = path.join(tempDir, exeName);

    // Already downloaded?
    if (fs.existsSync(destPath)) {
      console.log('[update] already downloaded:', destPath);
      pendingInstaller = destPath;
      toRenderer('update-ready', { version: manifest.version, notes: manifest.releaseNotes });
      showWinNotification(manifest.version, manifest.releaseNotes);
      return;
    }

    toRenderer('update-downloading', { version: manifest.version });
    console.log('[update] downloading', manifest.version);

    await downloadInstaller(
      manifest.windows.url,
      destPath,
      (pct) => toRenderer('update-progress', pct),
    );

    console.log('[update] download complete:', destPath);
    pendingInstaller = destPath;
    toRenderer('update-ready', { version: manifest.version, notes: manifest.releaseNotes });
    showWinNotification(manifest.version, manifest.releaseNotes);

  } catch (e) {
    console.log('[update] check failed (silent):', e.message);
  }
}

// ── Window ────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'preload.js')
        : path.join(__dirname, 'preload.js'),
    },
    icon:  path.join(__dirname, '../assets/icon.png'),
    title: 'Locas — Smart Billing',
    backgroundColor: '#FFF8F4',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC: PDF save ─────────────────────────────────────────────────
ipcMain.handle('save-pdf', async (_, { html, filename }) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice as PDF',
      defaultPath: filename || 'Invoice.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { success: false, reason: 'canceled' };

    const pdfWin = new BrowserWindow({
      width: 900, height: 1200, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise(r => setTimeout(r, 600));
    const buf = await pdfWin.webContents.printToPDF({
      printBackground: true, pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    pdfWin.close();
    fs.writeFileSync(filePath, buf);
    shell.openPath(filePath);
    return { success: true, filePath };
  } catch (e) {
    return { success: false, reason: e.message };
  }
});

// ── IPC: user clicked Install in-app ─────────────────────────────
ipcMain.handle('install-update', () => {
  console.log('[update] install-update IPC called, pendingInstaller:', pendingInstaller);
  if (pendingInstaller) {
    doInstall(pendingInstaller);
  } else {
    console.log('[update] no pendingInstaller — re-checking');
    checkForUpdate();
  }
});

// ── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  setTimeout(() => checkForUpdate(), 8000);
  updateCheckTimer = setInterval(() => checkForUpdate(), 2 * 60 * 60 * 1000);
});

app.on('window-all-closed', () => {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});