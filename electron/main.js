// @ts-nocheck
  /* eslint-disable */
  'use strict';

  const { app, BrowserWindow, shell, ipcMain, dialog, Notification } = require('electron');
  const path   = require('path');
  const fs     = require('fs');
  const https  = require('https');
  const crypto = require('crypto');

  const UPDATE_URL  = 'https://locas-business.vercel.app/updates/latest.json';
  const CURRENT_VER = app.getVersion();

  let mainWindow       = null;
  let updateCheckTimer = null;
  let pendingInstaller = null;

  // ── Data folder — always next to the .exe ────────────────────────
  // Works wherever user installs: C:\Program Files\Locas\, D:\locas-test\, anywhere.
  function getDataDir() {
    // userData = C:\Users\{name}\AppData\Roaming\Locas\
    // This folder is NEVER touched by the installer or uninstaller.
    // Data persists across updates, reinstalls, and install location changes.
    const dir = path.join(app.getPath('userData'), 'locas-data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  // ── One-time migration from old .locas-data/ next to exe ─────────
  // If user had v1.12.1 data stored next to Locas.exe, move it to userData
  // automatically so they don't lose anything on update.
  function migrateOldDataIfNeeded() {
    try {
      const oldDir = path.join(path.dirname(app.getPath('exe')), '.locas-data');
      const newDir = getDataDir();
      if (!fs.existsSync(oldDir)) return;
      const files = fs.readdirSync(oldDir).filter(f => f.endsWith('.json'));
      if (files.length === 0) return;
      // Only migrate if new dir is empty (don't overwrite newer data)
      const newFiles = fs.existsSync(newDir) ? fs.readdirSync(newDir).filter(f => f.endsWith('.json')) : [];
      if (newFiles.length > 0) return;
      console.log('[data] migrating', files.length, 'files from old location to userData');
      for (const file of files) {
        fs.copyFileSync(path.join(oldDir, file), path.join(newDir, file));
      }
      // Rename old dir so we don't migrate again
      fs.renameSync(oldDir, oldDir + '.migrated');
      console.log('[data] migration complete');
    } catch (e) {
      console.log('[data] migration error (non-fatal):', e.message);
    }
  }

  function dataFile(name) {
    return path.join(getDataDir(), name + '.json');
  }

  // ── Read a single store file ──────────────────────────────────────
  function readStore(name) {
    const f = dataFile(name);
    if (!fs.existsSync(f)) return {};
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch { return {}; }
  }

  // ── Write a single store file ─────────────────────────────────────
  function writeStore(name, data) {
    fs.writeFileSync(dataFile(name), JSON.stringify(data), 'utf8');
  }

  // ── Encryption helpers ────────────────────────────────────────────
  // Key = SHA-256 of "email:password" so only the owner can decrypt.
  // We don't store the password — we just derive the key at export/import time.
  const ALGO = 'aes-256-gcm';

  function deriveKey(email, password) {
    return crypto.createHash('sha256')
      .update(`${email.toLowerCase().trim()}:${password}`)
      .digest(); // 32 bytes
  }

  function encrypt(plaintext, key) {
    const iv  = crypto.randomBytes(12);
    const c   = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
    const tag = c.getAuthTag();
    // Format: iv(12) + tag(16) + ciphertext — all base64
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  function decrypt(b64, key) {
    const buf  = Buffer.from(b64, 'base64');
    const iv   = buf.slice(0, 12);
    const tag  = buf.slice(12, 28);
    const enc  = buf.slice(28);
    const d    = crypto.createDecipheriv(ALGO, key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  }

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
      if (fs.existsSync(dest + '.part')) fs.unlinkSync(dest + '.part');
      const file = fs.createWriteStream(dest + '.part');
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close(); fs.unlinkSync(dest + '.part');
          downloadInstaller(res.headers.location, dest, onProgress).then(resolve).catch(reject);
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0');
        let done = 0;
        res.on('data', chunk => {
          file.write(chunk); done += chunk.length;
          if (total > 0 && onProgress) onProgress(Math.round((done / total) * 100));
        });
        res.on('end', () => {
          file.end(() => { fs.renameSync(dest + '.part', dest); resolve(); });
        });
        res.on('error', (e) => { file.close(); try { fs.unlinkSync(dest + '.part'); } catch(_){} reject(e); });
      }).on('error', (e) => { file.close(); try { fs.unlinkSync(dest + '.part'); } catch(_){} reject(e); });
    });
  }

  // ── Send event to renderer ────────────────────────────────────────
  function toRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
  }

  // ── Open installer ────────────────────────────────────────────────
  function openInstaller(installerPath) {
    if (!fs.existsSync(installerPath)) {
      pendingInstaller = null; toRenderer('update-installer-missing', {}); return;
    }
    shell.openPath(installerPath).then((err) => {
      if (err) shell.showItemInFolder(installerPath);
    });
    // Close the app so the installer can replace the running exe
    setTimeout(() => app.quit(), 500);
  }

  // ── Update check + download ───────────────────────────────────────
  async function checkForUpdate(triggeredManually = false) {
    try {
      const manifest = await fetchManifest();
      if (!isNewer(manifest.version, CURRENT_VER)) {
        if (triggeredManually) toRenderer('update-already-latest', { version: CURRENT_VER });
        return;
      }
      const downloadsDir = app.getPath('downloads');
      const exeName      = `Locas.Setup.${manifest.version}.exe`;
      const destPath     = path.join(downloadsDir, exeName);
      if (fs.existsSync(destPath)) {
        pendingInstaller = destPath;
        toRenderer('update-ready', { version: manifest.version, notes: manifest.releaseNotes || '', path: destPath });
        return;
      }
      toRenderer('update-downloading', { version: manifest.version, notes: manifest.releaseNotes || '' });
      await downloadInstaller(manifest.windows.url, destPath, (pct) => toRenderer('update-progress', pct));
      pendingInstaller = destPath;
      toRenderer('update-ready', { version: manifest.version, notes: manifest.releaseNotes || '', path: destPath });
      if (Notification.isSupported()) {
        const n = new Notification({
          title: `Locas. ${manifest.version} downloaded ✓`,
          body:  'Click to open the installer and update.',
          icon:  path.join(__dirname, '../assets/icon.png'),
          silent: false,
        });
        n.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } openInstaller(destPath); });
        n.show();
      }
    } catch (e) {
      toRenderer('update-error', { message: e.message });
    }
  }

  async function checkPendingInstaller() {
    try {
      const manifest = await fetchManifest();
      if (!isNewer(manifest.version, CURRENT_VER)) return;
      const destPath = path.join(app.getPath('downloads'), `Locas.Setup.${manifest.version}.exe`);
      if (fs.existsSync(destPath)) {
        pendingInstaller = destPath;
        setTimeout(() => toRenderer('update-ready', { version: manifest.version, notes: manifest.releaseNotes || '', path: destPath }), 3000);
      }
    } catch (_) {}
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
      title: 'Locas. — Smart Billing',
      backgroundColor: '#FFF8F4',
      show: false,
    });
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  // ══════════════════════════════════════════════════════════════════
  // IPC — File-based data storage
  // ══════════════════════════════════════════════════════════════════

  // Read one store (e.g. 'invoices') → returns object keyed by id
  ipcMain.handle('db-read', (_, storeName) => {
    return readStore(storeName);
  });

  // Write one store
  ipcMain.handle('db-write', (_, storeName, data) => {
    writeStore(storeName, data);
    return true;
  });

  // Clear one store
  ipcMain.handle('db-clear', (_, storeName) => {
    writeStore(storeName, {});
    return true;
  });

  // Read a single key from a store
  ipcMain.handle('db-get', (_, storeName, key) => {
    const store = readStore(storeName);
    return store[key] ?? null;
  });

  // Write a single key to a store
  ipcMain.handle('db-set', (_, storeName, key, value) => {
    const store = readStore(storeName);
    store[key] = value;
    writeStore(storeName, store);
    return true;
  });

  // Remove a single key from a store
  ipcMain.handle('db-remove', (_, storeName, key) => {
    const store = readStore(storeName);
    delete store[key];
    writeStore(storeName, store);
    return true;
  });

  // Get all keys in a store
  ipcMain.handle('db-keys', (_, storeName) => {
    return Object.keys(readStore(storeName));
  });

  // Check if data folder has any data (for login screen)
  ipcMain.handle('db-has-data', () => {
    const profileFile = dataFile('business_profile');
    if (!fs.existsSync(profileFile)) return false;
    const profile = readStore('business_profile');
    return Object.keys(profile).length > 0;
  });

  // Get data folder path (shown in Settings)
  ipcMain.handle('db-data-path', () => {
    return getDataDir();
  });

  // Open data folder in Windows Explorer
  ipcMain.handle('db-open-folder', () => {
    shell.openPath(getDataDir());
    return true;
  });

  // ── EXPORT: produces one encrypted .lbk file ─────────────────────
  // All stores are bundled, encrypted with AES-256-GCM using key derived
  // from user's email+password. No one else can import this file.
  ipcMain.handle('db-export', async (_, { email, password, fromDate, toDate }) => {
    try {
      const STORES = ['business_profile','parties','items','invoices','invoice_items',
                      'payments','expenses','quotations','quotation_items',
                      'purchase_orders','po_items','meta'];

      // Read all stores
      const allData = {};
      for (const s of STORES) allData[s] = readStore(s);

      // Apply date filter to invoices, expenses, quotations if fromDate/toDate given
      if (fromDate || toDate) {
        const from = fromDate || '0000-00-00';
        const to   = toDate   || '9999-99-99';
        const filterByDate = (obj) => {
          const out = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v.date >= from && v.date <= to) out[k] = v;
          }
          return out;
        };
        allData.invoices    = filterByDate(allData.invoices    || {});
        allData.expenses    = filterByDate(allData.expenses    || {});
        allData.quotations  = filterByDate(allData.quotations  || {});
        allData.purchase_orders = filterByDate(allData.purchase_orders || {});
      }

      const payload = JSON.stringify({
        version: 2,
        exported_at: new Date().toISOString(),
        owner_email: email.toLowerCase().trim(),
        data: allData,
      });

      const key       = deriveKey(email, password);
      const encrypted = encrypt(payload, key);

      // Wrap in a thin envelope so we can detect "wrong password" vs "corrupt file"
      const envelope = JSON.stringify({
        locas: true,
        v: 2,
        owner: email.toLowerCase().trim(),
        payload: encrypted,
      });

      const dateStr  = new Date().toISOString().split('T')[0];
      const safeName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '-');
      const filename = `locasdot_${safeName}_${dateStr}.lbk`;

      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Locas. Backup',
        defaultPath: path.join(app.getPath('downloads'), filename),
        filters: [{ name: 'Locas Backup', extensions: ['lbk'] }],
      });

      if (canceled || !filePath) return { success: false, reason: 'canceled' };

      fs.writeFileSync(filePath, envelope, 'utf8');
      shell.showItemInFolder(filePath);
      return { success: true, filePath };

    } catch (e) {
      return { success: false, reason: e.message };
    }
  });

  // ── IMPORT: decrypts .lbk and writes all stores ──────────────────
  ipcMain.handle('db-import', async (_, { password }) => {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Locas. Backup',
        filters: [{ name: 'Locas Backup', extensions: ['lbk'] }],
        properties: ['openFile'],
      });

      if (canceled || !filePaths.length) return { success: false, reason: 'canceled' };

      const raw      = fs.readFileSync(filePaths[0], 'utf8');
      const envelope = JSON.parse(raw);

      if (!envelope.locas || envelope.v !== 2) {
        return { success: false, reason: 'invalid_file', message: 'This is not a valid Locas backup file.' };
      }

      const ownerEmail = envelope.owner;
      const key = deriveKey(ownerEmail, password);

      let payload;
      try {
        payload = JSON.parse(decrypt(envelope.payload, key));
      } catch {
        return { success: false, reason: 'wrong_password', message: 'Incorrect password. This file belongs to ' + ownerEmail };
      }

      if (payload.owner_email !== ownerEmail) {
        return { success: false, reason: 'corrupt', message: 'Backup file appears to be corrupted.' };
      }

      // Write all stores
      const data = payload.data || {};
      for (const [storeName, storeData] of Object.entries(data)) {
        writeStore(storeName, storeData || {});
      }

      return { success: true, ownerEmail };

    } catch (e) {
      return { success: false, reason: 'error', message: e.message };
    }
  });

  // ── IPC: userData path ────────────────────────────────────────────
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
        margins: { marginType: 'none' },
      });
      pdfWin.close();
      fs.writeFileSync(filePath, buf);
      shell.openPath(filePath);
      return { success: true, filePath };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  });

  // ── IPC: updates ─────────────────────────────────────────────────
  ipcMain.handle('check-for-update', () => { checkForUpdate(true); });
  ipcMain.handle('install-update', () => {
    if (pendingInstaller) openInstaller(pendingInstaller);
    else checkForUpdate(true);
  });

  // ── App lifecycle ─────────────────────────────────────────────────
  app.whenReady().then(() => {
    migrateOldDataIfNeeded(); // one-time move from exe folder → userData
    createWindow();
    setTimeout(() => checkPendingInstaller(), 4000);
    setTimeout(() => checkForUpdate(), 10000);
    updateCheckTimer = setInterval(() => checkForUpdate(), 2 * 60 * 60 * 1000);
  });

  app.on('window-all-closed', () => {
    if (updateCheckTimer) clearInterval(updateCheckTimer);
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });