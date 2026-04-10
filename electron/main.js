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
  let pendingInstaller = null;  // path to downloaded .exe waiting to be opened

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

  // ── Download installer to Downloads folder ────────────────────────
  // Saves to user's Downloads directory so they can find it easily.
  // Reports progress % to renderer for the animated progress bar.
  function downloadInstaller(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
      // Remove partial download if it exists
      if (fs.existsSync(dest + '.part')) fs.unlinkSync(dest + '.part');

      const file = fs.createWriteStream(dest + '.part');
      https.get(url, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest + '.part');
          downloadInstaller(res.headers.location, dest, onProgress)
            .then(resolve).catch(reject);
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0');
        let done = 0;

        res.on('data', chunk => {
          file.write(chunk);
          done += chunk.length;
          if (total > 0 && onProgress) {
            onProgress(Math.round((done / total) * 100));
          }
        });

        res.on('end', () => {
          file.end(() => {
            // Rename .part → final name only after complete download
            fs.renameSync(dest + '.part', dest);
            resolve();
          });
        });

        res.on('error', (e) => {
          file.close();
          try { fs.unlinkSync(dest + '.part'); } catch (_) {}
          reject(e);
        });
      }).on('error', (e) => {
        file.close();
        try { fs.unlinkSync(dest + '.part'); } catch (_) {}
        reject(e);
      });
    });
  }

  // ── Send event to renderer ────────────────────────────────────────
  function toRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  }

  // ── Open installer — shows the normal install wizard ─────────────
  // We NO LONGER use silent /S install because we don't have a code cert.
  // Instead we just open the .exe — user sees the normal Next/Next/Install wizard.
  function openInstaller(installerPath) {
    console.log('[update] opening installer for user:', installerPath);

    if (!fs.existsSync(installerPath)) {
      console.log('[update] installer file missing, re-downloading');
      pendingInstaller = null;
      toRenderer('update-installer-missing', {});
      return;
    }

    // shell.openPath opens the exe with the default handler = Windows runs it
    // User sees the normal NSIS installer window, clicks Next/Next/Install
    shell.openPath(installerPath).then((err) => {
      if (err) {
        console.log('[update] shell.openPath error:', err);
        // Fallback: show in Explorer so user can double-click manually
        shell.showItemInFolder(installerPath);
      }
      // Don't quit the app — user is still installing, they may cancel
      // The installer will handle the rest
    });
  }

  // ── Main check + download flow ────────────────────────────────────
  async function checkForUpdate(triggeredManually = false) {
    try {
      const manifest = await fetchManifest();

      if (!isNewer(manifest.version, CURRENT_VER)) {
        if (triggeredManually) {
          toRenderer('update-already-latest', { version: CURRENT_VER });
        }
        return;
      }

      // Save to user's Downloads folder
      const downloadsDir = app.getPath('downloads');
      const exeName      = `Locas.Setup.${manifest.version}.exe`;
      const destPath     = path.join(downloadsDir, exeName);

      // Already fully downloaded?
      if (fs.existsSync(destPath)) {
        console.log('[update] already downloaded:', destPath);
        pendingInstaller = destPath;
        toRenderer('update-ready', {
          version: manifest.version,
          notes:   manifest.releaseNotes || '',
          path:    destPath,
        });
        return;
      }

      // Notify renderer: download starting
      toRenderer('update-downloading', {
        version: manifest.version,
        notes:   manifest.releaseNotes || '',
      });

      console.log('[update] downloading', manifest.version, '→', destPath);

      await downloadInstaller(
        manifest.windows.url,
        destPath,
        (pct) => toRenderer('update-progress', pct),
      );

      console.log('[update] download complete:', destPath);
      pendingInstaller = destPath;

      toRenderer('update-ready', {
        version: manifest.version,
        notes:   manifest.releaseNotes || '',
        path:    destPath,
      });

      // Show system notification
      if (Notification.isSupported()) {
        const n = new Notification({
          title: `Locas ${manifest.version} downloaded ✓`,
          body:  'Click to open the installer and update.',
          icon:  path.join(__dirname, '../assets/icon.png'),
          silent: false,
        });
        n.on('click', () => {
          if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
          openInstaller(destPath);
        });
        n.show();
      }

    } catch (e) {
      console.log('[update] check failed:', e.message);
      toRenderer('update-error', { message: e.message });
    }
  }

  // ── On startup: check if a downloaded installer is already waiting ─
  // Handles the case where user downloaded but didn't install yet,
  // then restarted the app — banner should re-appear.
  async function checkPendingInstaller() {
    try {
      const manifest = await fetchManifest();
      if (!isNewer(manifest.version, CURRENT_VER)) return;

      const downloadsDir = app.getPath('downloads');
      const exeName      = `Locas.Setup.${manifest.version}.exe`;
      const destPath     = path.join(downloadsDir, exeName);

      if (fs.existsSync(destPath)) {
        console.log('[update] found pending installer on startup:', destPath);
        pendingInstaller = destPath;
        // Small delay so renderer is ready
        setTimeout(() => {
          toRenderer('update-ready', {
            version: manifest.version,
            notes:   manifest.releaseNotes || '',
            path:    destPath,
          });
        }, 3000);
      }
    } catch (e) {
      // Silently ignore on startup
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

  // ── IPC: userData path (preload device ID) ────────────────────────
  ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
  });

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

  // ── IPC: renderer triggered manual check (from Settings) ─────────
  ipcMain.handle('check-for-update', () => {
    checkForUpdate(true);
  });

  // ── IPC: user clicked "Open & Install" in the banner ─────────────
  ipcMain.handle('install-update', () => {
    if (pendingInstaller) {
      openInstaller(pendingInstaller);
    } else {
      // No installer cached — trigger a fresh check+download
      checkForUpdate(true);
    }
  });

  // ── App lifecycle ─────────────────────────────────────────────────
  app.whenReady().then(() => {
    createWindow();
    // Check for pending installer first (fast, shows banner quickly if already downloaded)
    setTimeout(() => checkPendingInstaller(), 4000);
    // Then do a full check (downloads if needed)
    setTimeout(() => checkForUpdate(), 10000);
    // Periodic check every 2 hours
    updateCheckTimer = setInterval(() => checkForUpdate(), 2 * 60 * 60 * 1000);
  });

  app.on('window-all-closed', () => {
    if (updateCheckTimer) clearInterval(updateCheckTimer);
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
