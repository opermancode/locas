/**
 * Data File Manager for LOCAS (Web / Electron)
 *
 * Web stores everything in IndexedDB via localforage — there is no
 * single file path. "Data file" operations map to:
 *   - checkExistingDataFile  → read owner_email from profile store
 *   - lockDataFile           → write owner_email via setDataOwner()
 *   - deleteDataFile         → clear all localforage stores
 *   - exportDataFile         → download a JSON backup
 *   - importDataFile         → load a JSON backup (web: JSON, not SQLite)
 *
 * Native (Android/iOS) path has been removed — that lives in the native repo.
 */

import { Platform } from 'react-native';
import { getDataOwner, setDataOwner, exportAllData, importAllData } from '../db';

// ─── CHECK EXISTING DATA ─────────────────────────────────────────

/**
 * Check whether any data exists for this browser/device.
 * @returns {Promise<{exists: boolean, dataOwner: string|null}>}
 */
export async function checkExistingDataFile() {
  try {
    const dataOwner = await getDataOwner();
    return {
      exists: !!dataOwner,
      dataOwner: dataOwner || null,
    };
  } catch (e) {
    console.warn('[dataFileManager] checkExistingDataFile error:', e.message);
    return { exists: false, dataOwner: null };
  }
}

// ─── LOCK DATA FILE ──────────────────────────────────────────────

/**
 * Lock this data to a specific email (called after first successful login).
 * On web this just persists the owner_email in the profile store.
 */
export async function lockDataFile(email) {
  try {
    await setDataOwner(email.toLowerCase().trim());
    return true;
  } catch (e) {
    console.error('[dataFileManager] lockDataFile error:', e.message);
    throw e;
  }
}

// ─── DELETE DATA FILE ────────────────────────────────────────────

/**
 * Wipe all local data (fresh start).
 * Clears every localforage store that LOCAS uses.
 */
export async function deleteDataFile() {
  try {
    const localforage = require('localforage');
    const storeNames = [
      'business_profile', 'parties', 'items',
      'invoices', 'invoice_items', 'payments',
      'expenses', 'quotations', 'quotation_items', 'meta',
    ];
    await Promise.all(
      storeNames.map(storeName =>
        localforage.createInstance({ name: 'locas', storeName }).clear()
      )
    );
    return true;
  } catch (e) {
    console.error('[dataFileManager] deleteDataFile error:', e.message);
    throw e;
  }
}

// ─── EXPORT DATA FILE ────────────────────────────────────────────

/**
 * Download a full JSON backup of all data.
 * Creates a <a download> link and clicks it.
 */
export async function exportDataFile() {
  try {
    const jsonData = await exportAllData();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `locas_backup_${timestamp}.json`;

    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  } catch (e) {
    console.error('[dataFileManager] exportDataFile error:', e.message);
    throw e;
  }
}

// ─── IMPORT DATA FILE ────────────────────────────────────────────

/**
 * Import a JSON backup file chosen by the user.
 * On web we parse it directly — no SQLite copy needed.
 * @param {string} fileUri  ignored on web (we use the stored File object)
 */
export async function importDataFile(fileUri) {
  try {
    // On web fileUri is a blob: URL created from the picked File
    const response = await fetch(fileUri);
    const text = await response.text();
    await importAllData(text);
    await clearStoredImportFile();
    return true;
  } catch (e) {
    console.error('[dataFileManager] importDataFile error:', e.message);
    throw e;
  }
}

// ─── PICK DATA FILE ──────────────────────────────────────────────

/**
 * Let the user pick a JSON backup file via a hidden <input>.
 * Reads the file, verifies it contains a data_owner, stores it
 * temporarily, and returns metadata.
 *
 * @returns {Promise<{success, dataOwner, fileUri, error}>}
 */
export async function pickDataFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ success: false, dataOwner: null, error: 'cancelled' });
        return;
      }

      try {
        const text = await file.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          resolve({ success: false, dataOwner: null, error: 'Invalid JSON file. Please select a valid LOCAS backup.' });
          return;
        }

        // Extract data owner from the backup
        const dataOwner =
          parsed?.profile?.[0]?.owner_email ||
          parsed?.profile?.[0]?.data_owner ||
          null;

        if (!dataOwner) {
          resolve({
            success: false, dataOwner: null,
            error: 'Could not find account info in this file. It may be corrupted or from an incompatible version.',
          });
          return;
        }

        // Create a blob URL so importDataFile can fetch it later
        const blob = new Blob([text], { type: 'application/json' });
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

// ─── STORED IMPORT FILE ──────────────────────────────────────────

async function storeImportFile(fileUri, dataOwner) {
  try {
    localStorage.setItem('locas_import_file', JSON.stringify({ fileUri, dataOwner }));
  } catch (e) {
    console.warn('[dataFileManager] storeImportFile:', e.message);
  }
}

export async function getStoredImportFile() {
  try {
    const data = localStorage.getItem('locas_import_file');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

export async function clearStoredImportFile() {
  try {
    localStorage.removeItem('locas_import_file');
  } catch (e) {
    // ignore
  }
}

// ─── VERIFY FILE OWNER ───────────────────────────────────────────

/**
 * Check that the login email matches the data file owner.
 */
export function verifyFileOwner(loginEmail, fileOwner) {
  if (!loginEmail || !fileOwner) return false;
  return loginEmail.toLowerCase().trim() === fileOwner.toLowerCase().trim();
}

// ─── PATH INFO (web stub) ─────────────────────────────────────────

/**
 * Returns human-readable info about where data is stored on this platform.
 * Used in Settings to answer "where is my data?"
 */
export function getDataStorageInfo() {
  return {
    type: 'IndexedDB (Browser)',
    location: 'Stored in your browser\'s IndexedDB under the key "locas"',
    note: 'Data persists across sessions but is browser-specific. Use Export Backup to save a portable copy.',
    exportName: 'locas_backup_YYYY-MM-DD.json',
  };
}
