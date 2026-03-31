/**
 * Data File Manager for LOCAS
 * 
 * Handles:
 * - Detecting existing data files
 * - Reading data owner from file
 * - Importing/exporting data files
 * - Creating new locked data files
 * 
 * Data file is SQLite database with `data_owner` stored in business_profile table
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { getDB } from '../db';

// Database file name
const DB_NAME = 'locas.db';

// ─── FILE PATHS ─────────────────────────────────────────────────────────────

/**
 * Get the path where database file is stored
 */
export function getDBPath() {
  if (Platform.OS === 'web') {
    // Web/Electron uses IndexedDB or localStorage, no file path
    return null;
  }
  return `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
}

/**
 * Get the SQLite directory path
 */
export function getSQLiteDir() {
  if (Platform.OS === 'web') return null;
  return `${FileSystem.documentDirectory}SQLite/`;
}

// ─── CHECK EXISTING FILE ────────────────────────────────────────────────────

/**
 * Check if a data file already exists on this device
 * @returns {Promise<{exists: boolean, dataOwner: string|null}>}
 */
export async function checkExistingDataFile() {
  try {
    if (Platform.OS === 'web') {
      // Web/Electron: Check localStorage/IndexedDB for data owner
      const dataOwner = await getDataOwnerFromDB();
      return {
        exists: !!dataOwner,
        dataOwner: dataOwner,
      };
    }

    // Native: Check if file exists
    const dbPath = getDBPath();
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    
    if (!fileInfo.exists) {
      return { exists: false, dataOwner: null };
    }

    // File exists, read data owner
    const dataOwner = await getDataOwnerFromDB();
    return {
      exists: true,
      dataOwner: dataOwner,
    };
  } catch (e) {
    console.error('Error checking existing data file:', e);
    return { exists: false, dataOwner: null };
  }
}

/**
 * Get data owner email from the database
 */
async function getDataOwnerFromDB() {
  try {
    const db = await getDB();
    
    if (Platform.OS === 'web') {
      // Web: Use localforage
      const profile = await db.getItem('business_profile');
      return profile?.data_owner || null;
    } else {
      // Native: Query SQLite
      const result = await db.getFirstAsync(
        'SELECT data_owner FROM business_profile LIMIT 1'
      );
      return result?.data_owner || null;
    }
  } catch (e) {
    // Table might not exist yet
    return null;
  }
}

// ─── LOCK DATA FILE ─────────────────────────────────────────────────────────

/**
 * Lock the data file to a specific email
 * Called after successful login on fresh start
 * 
 * @param {string} email - User's email to lock the file to
 */
export async function lockDataFile(email) {
  try {
    const db = await getDB();
    const now = new Date().toISOString().split('T')[0];
    
    if (Platform.OS === 'web') {
      // Web: Update localforage
      const profile = await db.getItem('business_profile') || {};
      profile.data_owner = email;
      profile.locked_at = now;
      await db.setItem('business_profile', profile);
    } else {
      // Native: Update SQLite
      // First ensure the column exists
      try {
        await db.runAsync('ALTER TABLE business_profile ADD COLUMN data_owner TEXT');
      } catch (e) {
        // Column might already exist
      }
      try {
        await db.runAsync('ALTER TABLE business_profile ADD COLUMN locked_at TEXT');
      } catch (e) {
        // Column might already exist
      }
      
      // Check if profile exists
      const existing = await db.getFirstAsync('SELECT id FROM business_profile LIMIT 1');
      
      if (existing) {
        await db.runAsync(
          'UPDATE business_profile SET data_owner = ?, locked_at = ?',
          [email, now]
        );
      } else {
        await db.runAsync(
          'INSERT INTO business_profile (data_owner, locked_at, name) VALUES (?, ?, ?)',
          [email, now, '']
        );
      }
    }
    
    console.log(`Data file locked to: ${email}`);
    return true;
  } catch (e) {
    console.error('Failed to lock data file:', e);
    throw e;
  }
}

// ─── IMPORT DATA FILE ───────────────────────────────────────────────────────

/**
 * Let user pick a data file to import
 * @returns {Promise<{success: boolean, dataOwner: string|null, error: string|null}>}
 */
export async function pickDataFile() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    
    if (result.canceled || !result.assets?.[0]) {
      return { success: false, dataOwner: null, error: 'cancelled' };
    }
    
    const file = result.assets[0];
    
    // Verify it's a valid SQLite file
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
      return { 
        success: false, 
        dataOwner: null, 
        error: 'Invalid file type. Please select a .db file.' 
      };
    }
    
    // Read data owner from the picked file
    const dataOwner = await readDataOwnerFromFile(file.uri);
    
    if (!dataOwner) {
      return {
        success: false,
        dataOwner: null,
        error: 'Could not read data owner from file. File may be corrupted.',
      };
    }
    
    // Store the file URI temporarily for import after login
    await storeImportFile(file.uri, dataOwner);
    
    return {
      success: true,
      dataOwner: dataOwner,
      fileUri: file.uri,
      error: null,
    };
  } catch (e) {
    console.error('Error picking data file:', e);
    return { success: false, dataOwner: null, error: e.message };
  }
}

/**
 * Read data owner from a file URI (without importing it)
 */
async function readDataOwnerFromFile(fileUri) {
  try {
    if (Platform.OS === 'web') {
      // Web: Read file as ArrayBuffer and parse SQLite
      // This is complex - for now just return null and handle differently
      return null;
    }
    
    // Native: Copy to temp location and read
    const tempPath = `${FileSystem.cacheDirectory}temp_import.db`;
    await FileSystem.copyAsync({ from: fileUri, to: tempPath });
    
    // Open temp database and read data_owner
    const SQLite = require('expo-sqlite');
    const tempDb = await SQLite.openDatabaseAsync('temp_import.db', {
      directory: FileSystem.cacheDirectory,
    });
    
    try {
      const result = await tempDb.getFirstAsync(
        'SELECT data_owner FROM business_profile LIMIT 1'
      );
      await tempDb.closeAsync();
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      return result?.data_owner || null;
    } catch (e) {
      await tempDb.closeAsync();
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      return null;
    }
  } catch (e) {
    console.error('Error reading data owner from file:', e);
    return null;
  }
}

/**
 * Store import file info temporarily
 */
async function storeImportFile(fileUri, dataOwner) {
  if (Platform.OS === 'web') {
    localStorage.setItem('locas_import_file', JSON.stringify({ fileUri, dataOwner }));
  } else {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('locas_import_file', JSON.stringify({ fileUri, dataOwner }));
  }
}

/**
 * Get stored import file info
 */
export async function getStoredImportFile() {
  try {
    if (Platform.OS === 'web') {
      const data = localStorage.getItem('locas_import_file');
      return data ? JSON.parse(data) : null;
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const data = await AsyncStorage.getItem('locas_import_file');
      return data ? JSON.parse(data) : null;
    }
  } catch (e) {
    return null;
  }
}

/**
 * Clear stored import file info
 */
export async function clearStoredImportFile() {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem('locas_import_file');
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('locas_import_file');
    }
  } catch (e) {
    // Ignore
  }
}

/**
 * Import the picked data file (replace current database)
 * Call this after successful login verification
 */
export async function importDataFile(fileUri) {
  try {
    if (Platform.OS === 'web') {
      // Web: Handle differently - maybe via IndexedDB import
      throw new Error('File import not supported on web. Please copy file manually.');
    }
    
    // Close current database connection
    const db = await getDB();
    await db.closeAsync();
    
    // Copy imported file to database location
    const dbPath = getDBPath();
    
    // Backup current database first
    const backupPath = `${getSQLiteDir()}locas_backup_${Date.now()}.db`;
    try {
      await FileSystem.copyAsync({ from: dbPath, to: backupPath });
    } catch (e) {
      // No existing file to backup
    }
    
    // Delete current database
    await FileSystem.deleteAsync(dbPath, { idempotent: true });
    
    // Copy imported file
    await FileSystem.copyAsync({ from: fileUri, to: dbPath });
    
    // Clear import file cache
    await clearStoredImportFile();
    
    console.log('Data file imported successfully');
    return true;
  } catch (e) {
    console.error('Error importing data file:', e);
    throw e;
  }
}

// ─── EXPORT DATA FILE ───────────────────────────────────────────────────────

/**
 * Export/download the current data file
 */
export async function exportDataFile() {
  try {
    if (Platform.OS === 'web') {
      // Web/Electron: Export as JSON or handle differently
      return await exportDataFileWeb();
    }
    
    const dbPath = getDBPath();
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    
    if (!fileInfo.exists) {
      throw new Error('No data file found');
    }
    
    // Create export copy with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const exportName = `locas_backup_${timestamp}.db`;
    const exportPath = `${FileSystem.cacheDirectory}${exportName}`;
    
    await FileSystem.copyAsync({ from: dbPath, to: exportPath });
    
    // Share/save the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Save LOCAS Backup',
        UTI: 'public.database',
      });
    } else {
      throw new Error('Sharing not available on this device');
    }
    
    // Clean up
    await FileSystem.deleteAsync(exportPath, { idempotent: true });
    
    return true;
  } catch (e) {
    console.error('Error exporting data file:', e);
    throw e;
  }
}

/**
 * Export data file for web/Electron
 */
async function exportDataFileWeb() {
  try {
    const { exportAllData } = require('../db');
    const jsonData = await exportAllData();
    
    // Create blob and download
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `locas_backup_${timestamp}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('Error exporting data file (web):', e);
    throw e;
  }
}

// ─── DELETE DATA FILE ───────────────────────────────────────────────────────

/**
 * Delete current data file (for fresh start)
 */
export async function deleteDataFile() {
  try {
    if (Platform.OS === 'web') {
      // Web: Clear localforage/IndexedDB
      const db = await getDB();
      await db.clear();
      return true;
    }
    
    // Close database first
    const db = await getDB();
    await db.closeAsync();
    
    // Delete the file
    const dbPath = getDBPath();
    await FileSystem.deleteAsync(dbPath, { idempotent: true });
    
    console.log('Data file deleted');
    return true;
  } catch (e) {
    console.error('Error deleting data file:', e);
    throw e;
  }
}

// ─── VERIFY FILE OWNER ──────────────────────────────────────────────────────

/**
 * Verify that the login email matches the data file owner
 * @param {string} loginEmail - Email user is trying to login with
 * @param {string} fileOwner - Email stored in data file
 * @returns {boolean}
 */
export function verifyFileOwner(loginEmail, fileOwner) {
  if (!loginEmail || !fileOwner) return false;
  return loginEmail.toLowerCase().trim() === fileOwner.toLowerCase().trim();
}