  /**
   * Data File Manager for LOCAS
   *
   * In Electron: data lives in .locas-data/ JSON files next to Locas.exe.
   *   Export → encrypted .lbk file (AES-256-GCM, locked to owner email+password)
   *   Import → decrypt .lbk, write all JSON store files
   *
   * In browser fallback: uses localforage / IndexedDB (original behaviour).
   *
   * IMPORTANT: isElectron() is a function, NOT a module-level constant.
   * The preload script injects window.electronAPI after the module loads,
   * so evaluating it at import time always returns false.
   */

  import { getDataOwner, setDataOwner, exportAllData, importAllData } from '../db';

  // ── Always evaluate lazily so preload injection is complete ───────
  function isElectron() {
    return typeof window !== 'undefined' && !!window.electronAPI?.db;
  }

  // ─── CHECK EXISTING DATA ─────────────────────────────────────────

  export async function checkExistingDataFile() {
    try {
      if (isElectron()) {
        const hasData = await window.electronAPI.db.hasData();
        if (!hasData) return { exists: false, dataOwner: null };
        const dataOwner = await getDataOwner();
        return { exists: true, dataOwner: dataOwner || null };
      }
      const dataOwner = await getDataOwner();
      return { exists: !!dataOwner, dataOwner: dataOwner || null };
    } catch (e) {
      return { exists: false, dataOwner: null };
    }
  }

  // ─── LOCK DATA FILE ──────────────────────────────────────────────

  export async function lockDataFile(email) {
    await setDataOwner(email.toLowerCase().trim());
    return true;
  }

  // ─── DELETE DATA FILE ────────────────────────────────────────────

  export async function deleteDataFile() {
    if (isElectron()) {
      const STORES = [
        'business_profile', 'parties', 'items', 'invoices', 'invoice_items',
        'payments', 'expenses', 'quotations', 'quotation_items',
        'purchase_orders', 'po_items', 'meta',
      ];
      await Promise.all(STORES.map(s => window.electronAPI.db.clear(s)));
      return true;
    }
    // Browser fallback
    const localforage = require('localforage');
    const storeNames = [
      'business_profile', 'parties', 'items', 'invoices', 'invoice_items',
      'payments', 'expenses', 'quotations', 'quotation_items', 'meta',
    ];
    await Promise.all(
      storeNames.map(n => localforage.createInstance({ name: 'locas', storeName: n }).clear())
    );
    return true;
  }

  // ─── EXPORT DATA FILE ────────────────────────────────────────────
  // Electron: IPC → main.js → AES-256-GCM encrypt → Save dialog → .lbk file
  // Browser:  exportAllData() → plain JSON download (legacy)

  export async function exportDataFile({ email, password, fromDate, toDate } = {}) {
    if (isElectron()) {
      // All work (reading stores, encrypting, showing save dialog) happens in main.js
      const result = await window.electronAPI.db.export({ email, password, fromDate, toDate });
      return result;
    }

    // ── Browser fallback (no encryption, plain JSON) ──────────────
    try {
      const jsonData  = await exportAllData();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename  = `locas_backup_${timestamp}.json`;
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, filename };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  }

  // ─── IMPORT DATA FILE ────────────────────────────────────────────
  // Electron: IPC → main.js → open file dialog → decrypt → write stores
  // Browser:  fetch blob URL → importAllData() (legacy)

  export async function importDataFile(fileUriOrPassword) {
    if (isElectron()) {
      // In Electron, fileUriOrPassword IS the password string.
      // main.js handles opening the file picker itself.
      const result = await window.electronAPI.db.import({ password: fileUriOrPassword });
      return result;
    }

    // ── Browser fallback ──────────────────────────────────────────
    try {
      const response = await fetch(fileUriOrPassword);
      const text     = await response.text();
      await importAllData(text);
      await clearStoredImportFile();
      return { success: true };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  }

  // ─── PICK DATA FILE ──────────────────────────────────────────────
  // Electron: file picking is handled inside db-import IPC in main.js.
  //           Return a sentinel so the caller knows to ask for a password.
  // Browser:  open <input type="file">, read the JSON, store blob URL.

  export async function pickDataFile() {
    if (isElectron()) {
      return { success: true, dataOwner: null, needsPassword: true, error: null };
    }

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = '.json,.lbk,application/json';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ success: false, dataOwner: null, error: 'cancelled' });
          return;
        }
        try {
          const text = await file.text();
          let parsed;
          try { parsed = JSON.parse(text); } catch {
            resolve({ success: false, dataOwner: null, error: 'Invalid file. Please select a valid Locas backup.' });
            return;
          }
          const dataOwner =
            parsed?.owner ||
            parsed?.profile?.[0]?.owner_email ||
            parsed?.profile?.[0]?.data_owner ||
            null;
          if (!dataOwner) {
            resolve({ success: false, dataOwner: null, error: 'Could not read account info from this file.' });
            return;
          }
          const blob    = new Blob([text], { type: 'application/json' });
          const fileUri = URL.createObjectURL(blob);
          await storeImportFile(fileUri, dataOwner);
          resolve({ success: true, dataOwner, fileUri, error: null });
        } catch (e) {
          resolve({ success: false, dataOwner: null, error: e.message });
        }
      };

      input.oncancel = () => resolve({ success: false, dataOwner: null, error: 'cancelled' });
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }

  // ─── STORED IMPORT FILE (browser only) ───────────────────────────

  async function storeImportFile(fileUri, dataOwner) {
    try {
      localStorage.setItem('locas_import_file', JSON.stringify({ fileUri, dataOwner }));
    } catch {}
  }

  export async function getStoredImportFile() {
    try {
      const data = localStorage.getItem('locas_import_file');
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }

  export async function clearStoredImportFile() {
    try { localStorage.removeItem('locas_import_file'); } catch {}
  }

  // ─── VERIFY FILE OWNER ───────────────────────────────────────────

  export function verifyFileOwner(loginEmail, fileOwner) {
    if (!loginEmail || !fileOwner) return false;
    return loginEmail.toLowerCase().trim() === fileOwner.toLowerCase().trim();
  }

  // ─── DATA PATH INFO ──────────────────────────────────────────────

  export async function getDataStorageInfo() {
    if (isElectron()) {
      const dataPath = await window.electronAPI.db.dataPath();
      return {
        type:       'Local JSON files',
        location:   dataPath,
        note:       'Data is stored as JSON files in the .locas-data folder next to Locas.exe. Export a .lbk backup to move to a new device.',
        exportName: 'locas_username_YYYY-MM-DD.lbk',
      };
    }
    return {
      type:       'IndexedDB (Browser)',
      location:   'Stored in your browser\'s IndexedDB under the key "locas"',
      note:       'Data persists across sessions but is browser-specific. Use Export Backup to save a portable copy.',
      exportName: 'locas_backup_YYYY-MM-DD.json',
    };
  }

  export async function openDataFolder() {
    if (isElectron()) await window.electronAPI.db.openFolder();
  }